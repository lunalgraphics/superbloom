/**
 * WebGL resource management utilities.
 * Provides context detection, FBO lifecycle, shader compilation, and geometry helpers.
 */

/**
 * Detect the best available WebGL context for a canvas element.
 * Tries WebGL2 first, then falls back to WebGL1.
 *
 * @param {HTMLCanvasElement} canvas - The canvas element to get a context from
 * @returns {'webgl2' | 'webgl' | null} The context type string, or null if unavailable
 */
export function detectWebGL(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') {
        return null;
    }

    const gl2 = canvas.getContext('webgl2');
    if (gl2) {
        return 'webgl2';
    }

    const gl1 = canvas.getContext('webgl');
    if (gl1) {
        return 'webgl';
    }

    return null;
}

/**
 * Create a framebuffer object (FBO) with an attached RGBA texture.
 * The texture uses LINEAR filtering (min/mag) and CLAMP_TO_EDGE wrapping.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl - The WebGL context
 * @param {number} width - Texture width in pixels
 * @param {number} height - Texture height in pixels
 * @returns {{ fbo: WebGLFramebuffer, texture: WebGLTexture }} The framebuffer and its color attachment
 */
export function createFBO(gl, width, height) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    // Unbind to leave clean state
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return { fbo, texture };
}

/**
 * Resize an existing FBO's texture in-place without re-creating the WebGL objects.
 * Re-allocates GPU storage by calling texImage2D with the new dimensions.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl - The WebGL context
 * @param {WebGLFramebuffer} fbo - The framebuffer object (unused but kept for API consistency)
 * @param {WebGLTexture} texture - The texture to resize
 * @param {number} width - New width in pixels
 * @param {number} height - New height in pixels
 */
export function resizeFBO(gl, fbo, texture, width, height) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
}

/**
 * Delete a framebuffer object and its associated texture, freeing GPU memory.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl - The WebGL context
 * @param {{ fbo: WebGLFramebuffer, texture: WebGLTexture }} fboObj - The FBO object returned by createFBO
 */
export function deleteFBO(gl, fboObj) {
    if (fboObj.texture) {
        gl.deleteTexture(fboObj.texture);
    }
    if (fboObj.fbo) {
        gl.deleteFramebuffer(fboObj.fbo);
    }
}

/**
 * Compile a vertex shader and fragment shader, link them into a program.
 * On any compilation or link failure, logs the info log and returns null.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl - The WebGL context
 * @param {string} vertSrc - GLSL source for the vertex shader
 * @param {string} fragSrc - GLSL source for the fragment shader
 * @returns {WebGLProgram | null} The linked program, or null on failure
 */
export function createProgram(gl, vertSrc, fragSrc) {
    const vertShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertShader, vertSrc);
    gl.compileShader(vertShader);

    if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
        console.error('Vertex shader compilation failed:', gl.getShaderInfoLog(vertShader));
        gl.deleteShader(vertShader);
        return null;
    }

    const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragShader, fragSrc);
    gl.compileShader(fragShader);

    if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
        console.error('Fragment shader compilation failed:', gl.getShaderInfoLog(fragShader));
        gl.deleteShader(vertShader);
        gl.deleteShader(fragShader);
        return null;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program linking failed:', gl.getProgramInfoLog(program));
        gl.deleteShader(vertShader);
        gl.deleteShader(fragShader);
        gl.deleteProgram(program);
        return null;
    }

    // Shaders can be detached and deleted after successful linking
    gl.detachShader(program, vertShader);
    gl.detachShader(program, fragShader);
    gl.deleteShader(vertShader);
    gl.deleteShader(fragShader);

    return program;
}

/**
 * Create a VBO containing a fullscreen quad (two triangles) in NDC [-1, 1].
 * The caller should cache the returned buffer and reuse it across draw calls.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext} gl - The WebGL context
 * @returns {WebGLBuffer} The vertex buffer object for the fullscreen quad
 */
export function bindFullscreenQuad(gl) {
    // Two triangles covering the full NDC range [-1, 1] in 2D
    // Triangle 1: bottom-left, bottom-right, top-right
    // Triangle 2: bottom-left, top-right, top-left
    const vertices = new Float32Array([
        -1, -1,
         1, -1,
         1,  1,
        -1, -1,
         1,  1,
        -1,  1,
    ]);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    return vbo;
}
