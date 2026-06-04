/**
 * Bloom rendering router.
 *
 * Delegates to the WebGL pipeline when GPU acceleration is available,
 * otherwise falls back to the Canvas 2D implementation.
 */

import { renderBloomWebGL, isWebGLReady } from './webgl-pipeline.js';
import { renderBloomCanvas2D } from './bloom-canvas2d.js';

/**
 * Renders the bloom effect onto the provided canvases.
 *
 * @param {object} params - Effect parameters (threshold, glowLayers, glowRadius, etc.)
 * @param {HTMLCanvasElement} threshCanv - Canvas for the threshold/mask pass
 * @param {HTMLCanvasElement} glowCanv - Canvas for the glow layer
 * @param {HTMLCanvasElement} compCanv - Canvas for the final composite
 * @param {object} options
 * @param {boolean} [options.skipComposite=false] - If true, skip compositing onto the base image
 * @param {function} [options.onComplete] - Called when rendering is finished
 */
export function renderBloom(params, threshCanv, glowCanv, compCanv, options = {}) {
    if (isWebGLReady()) {
        renderBloomWebGL(params, threshCanv, glowCanv, compCanv, options);
    } else {
        renderBloomCanvas2D(params, threshCanv, glowCanv, compCanv, options);
    }
}
