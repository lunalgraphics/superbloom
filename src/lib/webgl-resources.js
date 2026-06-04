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
