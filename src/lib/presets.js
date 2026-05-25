/**
 * Preset management utilities.
 *
 * Presets store only the effect parameters (not UI state or runtime data).
 */

/** Keys that are part of a preset (effect parameters only) */
const PRESET_KEYS = [
    "threshold",
    "glowLayers",
    "glowRadius",
    "colorize",
    "tintcolor",
    "saturation",
    "hue",
    "tintopacity",
    "brightness",
    "anamorph",
];

/**
 * Extracts serializable preset data from the full state object.
 *
 * @param {object} state - The full globals/state object
 * @returns {string} JSON string of the preset
 */
export function getPresetData(state) {
    let preset = {};
    for (let key of PRESET_KEYS) {
        if (key in state) {
            preset[key] = state[key];
        }
    }
    return JSON.stringify(preset);
}

/**
 * Parses a preset (string or object) and returns a validated object
 * containing only known preset keys.
 *
 * @param {string|object} preset - Raw preset data
 * @returns {object} Validated preset object with only known keys
 */
export function parsePreset(preset) {
    if (typeof preset === "string") {
        preset = JSON.parse(preset);
    }
    let result = {};
    for (let key of PRESET_KEYS) {
        if (key in preset) {
            result[key] = preset[key];
        }
    }
    return result;
}

/**
 * Triggers a browser download of the preset as a JSON file.
 *
 * @param {object} state - The full globals/state object
 */
export function exportPreset(state) {
    let data = getPresetData(state);
    let blob = new Blob([data], { type: "application/json" });

    let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "superbloom-preset.json";
    a.click();
}
