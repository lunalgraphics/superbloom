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
 * Upload an image to a WebGL texture at the specified dimensions.
 * Binds the texture, then calls texImage2D with the source image.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl - The WebGL context
 * @param {WebGLTexture} texture - The texture to upload into
 * @param {TexImageSource} image - The source image (HTMLImageElement, HTMLCanvasElement, etc.)
 * @param {number} w - Target texture width in pixels
 * @param {number} h - Target texture height in pixels
 */
function uploadTexture(gl, texture, image, w, h) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
}

/**
 * Execute a single shader pass: bind program, set destination FBO, set viewport,
 * upload all uniforms, bind fullscreen quad, and draw.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl - The WebGL context
 * @param {WebGLProgram} program - The compiled shader program to use
 * @param {{ fbo: WebGLFramebuffer, texture: WebGLTexture } | null} dstFBO - Destination FBO, or null for default framebuffer (renders to glCanvas)
 * @param {number} w - Viewport width
 * @param {number} h - Viewport height
 * @param {Object} uniforms - Object mapping uniform names to values. Supported types:
 *   - number → gl.uniform1f
 *   - boolean → gl.uniform1i (0 or 1)
 *   - Array(2) → gl.uniform2fv
 *   - Array(3) → gl.uniform3fv
 *   - WebGLTexture → bind to texture unit, gl.uniform1i with unit index
 */
function runPass(gl, program, dstFBO, w, h, uniforms) {
    gl.useProgram(program);

    // Bind destination framebuffer (null = default framebuffer → renders to glCanvas)
    if (dstFBO) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, dstFBO.fbo);
    } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // Set viewport
    gl.viewport(0, 0, w, h);

    // Upload uniforms with type detection
    let textureUnit = 0;
    for (const [name, value] of Object.entries(uniforms)) {
        const loc = gl.getUniformLocation(program, name);
        if (loc === null) continue;

        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            // sampler2D: bind texture to a unit and set uniform to unit index
            gl.activeTexture(gl.TEXTURE0 + textureUnit);
            gl.bindTexture(gl.TEXTURE_2D, value);
            gl.uniform1i(loc, textureUnit);
            textureUnit++;
        } else if (typeof value === 'boolean') {
            gl.uniform1i(loc, value ? 1 : 0);
        } else if (typeof value === 'number') {
            gl.uniform1f(loc, value);
        } else if (Array.isArray(value) && value.length === 2) {
            gl.uniform2fv(loc, value);
        } else if (Array.isArray(value) && value.length === 3) {
            gl.uniform3fv(loc, value);
        }
    }

    // Bind the fullscreen quad VBO and enable vertex attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, state.quadVBO);
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Draw the fullscreen quad (6 vertices, 2 triangles)
    gl.drawArrays(gl.TRIANGLES, 0, 6);
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
 * Parse a CSS hex color string (#RRGGBB) to normalized [r, g, b] in [0, 1].
 * @param {string} cssHex - CSS hex color string, e.g. '#FF8800'
 * @returns {number[]} Array of [r, g, b] with values in [0, 1]
 */
function parseTintColor(cssHex) {
    const hex = cssHex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return [r, g, b];
}

/**
 * Render srcTexture to the internal glCanvas using the passthrough shader,
 * then copy the result to the destination canvas via 2D drawImage.
 *
 * srcW/srcH control the viewport size for the WebGL render pass.
 * dstW/dstH control the output canvas dimensions (enabling anamorphic stretch
 * when they differ from srcW/srcH).
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl - The WebGL context
 * @param {WebGLProgram} program - The passthrough shader program
 * @param {HTMLCanvasElement} destCanvas - The destination canvas to write to
 * @param {number} dstW - Destination canvas width
 * @param {number} dstH - Destination canvas height
 * @param {WebGLTexture} srcTexture - The source texture to render
 * @param {number} [srcW] - Viewport width for the WebGL render pass (defaults to state.currentWidth)
 * @param {number} [srcH] - Viewport height for the WebGL render pass (defaults to state.currentHeight)
 */
function writeToCanvas(gl, program, destCanvas, dstW, dstH, srcTexture, srcW, srcH) {
    // 1. Use runPass to render srcTexture to glCanvas (default framebuffer) using passthrough shader
    //    Pass srcW/srcH as the viewport dimensions for the WebGL render
    runPass(gl, program, null, srcW || state.currentWidth, srcH || state.currentHeight, {
        u_source: srcTexture,
    });

    // 2. Set destination canvas dimensions
    destCanvas.width = dstW;
    destCanvas.height = dstH;

    // 3. Use 2D context drawImage to copy from glCanvas to destCanvas
    const ctx = destCanvas.getContext('2d');
    ctx.drawImage(state.glCanvas, 0, 0, dstW, dstH);
}

/**
 * Placeholder for the full render function (implemented in task 7.1).
 */
export function renderBloomWebGL(params, threshCanv, glowCanv, compCanv, options = {}) {
    // Will be implemented in task 7.1
}

// Exported for testing
export { initContext, ensureDimensions, parseTintColor, writeToCanvas, state, uploadTexture, runPass };
