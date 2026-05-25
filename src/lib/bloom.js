/**
 * Core bloom/glow processing pipeline.
 *
 * Takes a source image and effect parameters, renders the bloom effect
 * across three canvases: threshold mask, glow layer, and final composite.
 */

import isolateHighlights from "$lib/scripts/isolate-highlights.js";

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
export function renderBloom(params, threshCanv, glowCanv, compCanv, { skipComposite = false, onComplete } = {}) {
    // --- Pass 1: Threshold mask ---
    threshCanv.width = params.baseIMG.width * params.previewQuality;
    threshCanv.height = params.baseIMG.height * params.previewQuality;

    let ctx = threshCanv.getContext("2d");
    ctx.restore();
    ctx.drawImage(params.baseIMG, 0, 0, threshCanv.width, threshCanv.height);
    ctx.save();

    if (params.threshold < 255) {
        isolateHighlights(ctx, params.threshold);
    } else {
        // Threshold at max means no highlights pass through — fill black
        ctx.fillRect(0, 0, threshCanv.width, threshCanv.height);
    }

    // Optional colorization of the mask
    if (params.colorize) {
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = params.tintopacity / 100;
        ctx.fillStyle = params.tintcolor;
        ctx.globalCompositeOperation = "color";
        ctx.fillRect(0, 0, threshCanv.width, threshCanv.height);
        ctx.globalCompositeOperation = "multiply";
        ctx.fillRect(0, 0, threshCanv.width, threshCanv.height);
    }

    // --- Pass 2: Glow (iterative blur with screen blending) ---
    glowCanv.width = threshCanv.width;
    glowCanv.height = threshCanv.height;
    let ctx2 = glowCanv.getContext("2d");
    ctx2.clearRect(0, 0, glowCanv.width, glowCanv.height);
    ctx2.save();

    for (let i = 1; i < params.glowLayers; i++) {
        let blurRadius = (i + 1) ** 2 * params.glowRadius * params.previewQuality;
        ctx2.restore();
        ctx2.save();
        ctx2.filter = `brightness(${params.brightness}%) hue-rotate(${params.hue}deg) saturate(${params.saturation}%) blur(${blurRadius}px)`;
        ctx2.globalCompositeOperation = "screen";
        ctx2.drawImage(threshCanv, 0, 0, glowCanv.width / (params.anamorph + 1), glowCanv.height);
    }

    // Apply anamorphic stretch
    ctx2.restore();
    ctx2.drawImage(glowCanv, 0, 0, glowCanv.width * (params.anamorph + 1), glowCanv.height);

    if (skipComposite) {
        if (onComplete) onComplete();
        return;
    }

    // --- Pass 3: Composite (base + glow with screen blending) ---
    compCanv.width = threshCanv.width;
    compCanv.height = threshCanv.height;
    let ctx3 = compCanv.getContext("2d");
    ctx3.restore();
    ctx3.save();
    ctx3.clearRect(0, 0, compCanv.width, compCanv.height);
    ctx3.drawImage(params.baseIMG, 0, 0, compCanv.width, compCanv.height);
    ctx3.globalCompositeOperation = "screen";
    ctx3.drawImage(glowCanv, 0, 0, compCanv.width, compCanv.height);
    ctx3.restore();
    ctx3.save();

    if (onComplete) onComplete();
}
