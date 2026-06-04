/**
 * WebGL bloom rendering pipeline.
 *
 * Owns the offscreen WebGL canvas, compiles all shader programs once,
 * manages FBO lifecycle, and orchestrates multi-pass rendering.
 */

import { SHADERS } from './webgl-shaders.js';
import { detectWebGL, createFBO, resizeFBO, createProgram, bindFullscreenQuad } from './webgl-resources.js';

// Module-level flag: once set to false, WebGL is permanently unavailable
// (distinct from contextLost, which is recoverable).
let webglAvailable = true;

/**
 * Pipeline state object — holds all mutable GPU state.
 */
const state = {
    // Context
    gl: null,
    glCanvas: null,
    contextVersion: 0,

    // Compiled programs (null until initContext runs)
    programs: {
        threshold: null,
        downsample: null,
        upsample: null,
        colorize: null,
        composite: null,
        passthrough: null,
    },

    // Geometry
    quadVBO: null,

    // Textures and FBOs
    sourceTexture: null,
    threshFBO: null,
    pingFBO: null,
    pongFBO: null,
    glowFBO: null,

    // Dimension tracking (for FBO resize guard)
    currentWidth: 0,
    currentHeight: 0,

    // Context loss
    contextLost: false,

    // Cancellation token
    renderToken: 0,
};

/**
 * Initialize the WebGL context, compile all programs, allocate FBOs,
 * and set up context-loss listeners.
 *
 * @returns {boolean} true if initialization succeeded, false otherwise
 */
function initContext() {
    // 1. Create an offscreen canvas element (NOT added to DOM)
    const canvas = document.createElement('canvas');

    // 2. Detect best available WebGL context type
    const contextType = detectWebGL(canvas);
    if (!contextType) {
        webglAvailable = false;
        return false;
    }

    // 3. Acquire the actual WebGL context
    const gl = canvas.getContext(contextType);
    if (!gl) {
        webglAvailable = false;
        return false;
    }

    // 4. Compile all shader programs
    const programs = {
        threshold: createProgram(gl, SHADERS.VERT_FULLSCREEN, SHADERS.FRAG_THRESHOLD),
        downsample: createProgram(gl, SHADERS.VERT_FULLSCREEN, SHADERS.FRAG_DOWNSAMPLE),
        upsample: createProgram(gl, SHADERS.VERT_FULLSCREEN, SHADERS.FRAG_UPSAMPLE),
        colorize: createProgram(gl, SHADERS.VERT_FULLSCREEN, SHADERS.FRAG_COLORIZE),
        composite: createProgram(gl, SHADERS.VERT_FULLSCREEN, SHADERS.FRAG_COMPOSITE),
        passthrough: createProgram(gl, SHADERS.VERT_FULLSCREEN, SHADERS.FRAG_PASSTHROUGH),
    };

    // If any program failed to compile/link, mark WebGL as unavailable
    for (const key of Object.keys(programs)) {
        if (!programs[key]) {
            webglAvailable = false;
            return false;
        }
    }

    // 5. Allocate four FBOs at initial 1x1 dimensions (resized before first render)
    const threshFBO = createFBO(gl, 1, 1);
    const pingFBO = createFBO(gl, 1, 1);
    const pongFBO = createFBO(gl, 1, 1);
    const glowFBO = createFBO(gl, 1, 1);

    // Verify FBO completeness
    const fbos = [threshFBO, pingFBO, pongFBO, glowFBO];
    for (const fboObj of fbos) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fboObj.fbo);
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('FBO incomplete:', status);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            webglAvailable = false;
            return false;
        }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // 6. Create sourceTexture (plain WebGL texture for base image uploads)
    const sourceTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // 7. Bind the fullscreen quad VBO
    const quadVBO = bindFullscreenQuad(gl);

    // 8. Register context loss/restore listeners
    canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        state.contextLost = true;
    });

    canvas.addEventListener('webglcontextrestored', () => {
        state.contextLost = false;
    });

    // 9. Store everything in state
    state.gl = gl;
    state.glCanvas = canvas;
    state.contextVersion = contextType === 'webgl2' ? 2 : 1;
    state.programs = programs;
    state.quadVBO = quadVBO;
    state.sourceTexture = sourceTexture;
    state.threshFBO = threshFBO;
    state.pingFBO = pingFBO;
    state.pongFBO = pongFBO;
    state.glowFBO = glowFBO;
    state.currentWidth = 0;
    state.currentHeight = 0;
    state.contextLost = false;

    return true;
}

/**
 * Resize all FBOs and the offscreen canvas when dimensions change.
 * No-op if width and height already match the current state.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl - The WebGL context
 * @param {object} state - The pipeline state object
 * @param {number} width - New width in pixels
 * @param {number} height - New height in pixels
 */
function ensureDimensions(gl, state, width, height) {
    if (state.currentWidth === width && state.currentHeight === height) return;
    resizeFBO(gl, state.threshFBO.fbo, state.threshFBO.texture, width, height);
    resizeFBO(gl, state.pingFBO.fbo, state.pingFBO.texture, width, height);
    resizeFBO(gl, state.pongFBO.fbo, state.pongFBO.texture, width, height);
    resizeFBO(gl, state.glowFBO.fbo, state.glowFBO.texture, width, height);
    state.glCanvas.width = width;
    state.glCanvas.height = height;
    state.currentWidth = width;
    state.currentHeight = height;
}

/**
 * Returns true when the WebGL pipeline is ready to render.
 *
 * @returns {boolean}
 */
export function isWebGLReady() {
    return state.gl !== null && !state.contextLost && webglAvailable;
}

/**
 * Placeholder for the full render function (implemented in task 7.1).
 */
export function renderBloomWebGL(params, threshCanv, glowCanv, compCanv, options = {}) {
    // Will be implemented in task 7.1
}

// Exported for testing
export { initContext, ensureDimensions, state };
