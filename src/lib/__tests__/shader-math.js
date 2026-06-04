/**
 * Pure-JS mirror functions that replicate the GLSL shader formulas
 * from webgl-shaders.js. Used by property-based tests (fast-check)
 * to validate shader math without requiring a WebGL context.
 */

/**
 * Clamp a value to [min, max].
 */
function clamp(x, lo, hi) {
    return Math.min(Math.max(x, lo), hi);
}

/**
 * Threshold linear remap — mirrors FRAG_THRESHOLD.
 * Maps [t, 1] → [0, 1], clamps below t to 0.
 * @param {number} v - normalized pixel channel value [0, 1]
 * @param {number} t - normalized threshold [0, 1]
 * @returns {number} remapped value in [0, 1]
 */
export function thresholdRemap(v, t) {
    return clamp((v - t) / (1.0 - t + 0.0001), 0.0, 1.0);
}

/**
 * Kawase sample offset — mirrors the u_offset computation.
 * @param {number} i - iteration index (0-based)
 * @param {number} R - glowRadius multiplier
 * @returns {number} texel offset
 */
export function kawaseOffset(i, R) {
    return (i + 0.5) * R;
}

/**
 * Screen blend — mirrors FRAG_COMPOSITE.
 * result = 1 - (1 - a) * (1 - b)
 * @param {number} a - value in [0, 1]
 * @param {number} b - value in [0, 1]
 * @returns {number} blended value in [0, 1]
 */
export function screenBlend(a, b) {
    return 1.0 - (1.0 - a) * (1.0 - b);
}

/**
 * RGB to HSL conversion — exact port of the GLSL rgb2hsl helper.
 * @param {number} r - red [0, 1]
 * @param {number} g - green [0, 1]
 * @param {number} b - blue [0, 1]
 * @returns {[number, number, number]} [h, s, l] where h is in [0, 1)
 */
export function rgb2hsl(r, g, b) {
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const l = (maxC + minC) * 0.5;

    if (maxC === minC) return [0.0, 0.0, l];

    const d = maxC - minC;
    const s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);

    let h;
    if (maxC === r) {
        h = (g - b) / d + (g < b ? 6.0 : 0.0);
    } else if (maxC === g) {
        h = (b - r) / d + 2.0;
    } else {
        h = (r - g) / d + 4.0;
    }
    h /= 6.0;

    return [h, s, l];
}

/**
 * Helper for HSL to RGB — exact port of hue2rgb GLSL helper.
 */
function hue2rgb(p, q, t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
    if (t < 0.5) return q;
    if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
    return p;
}

/**
 * HSL to RGB conversion — exact port of the GLSL hsl2rgb helper.
 * @param {number} h - hue [0, 1]
 * @param {number} s - saturation [0, 1]
 * @param {number} l - lightness [0, 1]
 * @returns {[number, number, number]} [r, g, b] each in [0, 1]
 */
export function hsl2rgb(h, s, l) {
    if (s === 0.0) return [l, l, l];

    const q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
    const p = 2.0 * l - q;

    return [
        hue2rgb(p, q, h + 1.0 / 3.0),
        hue2rgb(p, q, h),
        hue2rgb(p, q, h - 1.0 / 3.0),
    ];
}

/**
 * Rotate hue by a given number of degrees.
 * Converts RGB → HSL, shifts hue, converts back.
 * @param {[number, number, number]} rgb - [r, g, b] each in [0, 1]
 * @param {number} degrees - hue rotation in degrees
 * @returns {[number, number, number]} [r, g, b] each in [0, 1]
 */
export function rotateHue(rgb, degrees) {
    const [h, s, l] = rgb2hsl(rgb[0], rgb[1], rgb[2]);
    // fract(h + degrees/360) — wraps to [0, 1)
    let newH = h + degrees / 360.0;
    newH = newH - Math.floor(newH); // equivalent to GLSL fract()
    return hsl2rgb(newH, s, l);
}

/**
 * Selective saturation formula — mirrors the GLSL colorize pass.
 * effective_saturation = 100 / (existing_saturation_pct + 1)
 * @param {number} existingSatPct - existing saturation percentage [0, 100]
 * @returns {number} effective saturation boost factor
 */
export function effectiveSaturation(existingSatPct) {
    return 100.0 / (existingSatPct + 1.0);
}

/**
 * Luminance (Rec. 709) — mirrors the GLSL luma() function.
 * @param {number} r - red [0, 1]
 * @param {number} g - green [0, 1]
 * @param {number} b - blue [0, 1]
 * @returns {number} luminance
 */
export function luma(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Set luminance — mirrors the GLSL setLuma() function.
 * Adjusts RGB so its luminance matches targetLuma, clamped to [0, 1].
 * @param {[number, number, number]} rgb - [r, g, b] each in [0, 1]
 * @param {number} targetLuma - desired luminance
 * @returns {[number, number, number]} adjusted [r, g, b]
 */
export function setLuma(rgb, targetLuma) {
    const d = targetLuma - luma(rgb[0], rgb[1], rgb[2]);
    return [
        clamp(rgb[0] + d, 0.0, 1.0),
        clamp(rgb[1] + d, 0.0, 1.0),
        clamp(rgb[2] + d, 0.0, 1.0),
    ];
}

/**
 * Color blend mode — preserves luminance of source, applies hue+chroma of tint.
 * Mirrors the tint logic in FRAG_COLORIZE:
 *   tinted = setLuma(tintRgb, luma(srcRgb))
 *   result = mix(srcRgb, tinted, opacity)
 * @param {[number, number, number]} srcRgb - source [r, g, b] in [0, 1]
 * @param {[number, number, number]} tintRgb - tint color [r, g, b] in [0, 1]
 * @param {number} opacity - blend opacity [0, 1]
 * @returns {[number, number, number]} blended [r, g, b]
 */
export function colorBlend(srcRgb, tintRgb, opacity) {
    const srcLuma = luma(srcRgb[0], srcRgb[1], srcRgb[2]);
    const tinted = setLuma(tintRgb, srcLuma);
    return [
        srcRgb[0] + (tinted[0] - srcRgb[0]) * opacity,
        srcRgb[1] + (tinted[1] - srcRgb[1]) * opacity,
        srcRgb[2] + (tinted[2] - srcRgb[2]) * opacity,
    ];
}

/**
 * Anamorphic stretch width — mirrors the render loop dimension calc.
 * @param {number} W - native glow layer width
 * @param {number} a - anamorph value (0 = no stretch)
 * @returns {number} stretched width
 */
export function anamorphWidth(W, a) {
    return Math.round(W * (a + 1));
}

/**
 * Preview quality dimension scaling — mirrors the render loop.
 * @param {number} W - base image width
 * @param {number} H - base image height
 * @param {number} q - previewQuality scalar (0.01–1.0)
 * @returns {{ w: number, h: number }} scaled dimensions (min 1)
 */
export function previewDims(W, H, q) {
    return {
        w: Math.max(1, Math.round(W * q)),
        h: Math.max(1, Math.round(H * q)),
    };
}
