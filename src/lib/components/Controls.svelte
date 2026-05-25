<script>
    import { createEventDispatcher } from "svelte";
    import { exportPreset } from "$lib/presets.js";

    import defaultPreset from "$lib/presets/default.json?raw";
    import softHazePreset from "$lib/presets/soft-haze.json?raw";
    import jediPreset from "$lib/presets/jedi.json?raw";
    import cinematicPreset from "$lib/presets/cinematic.json?raw";
    import sunsetPreset from "$lib/presets/sunset.json?raw";

    const dispatch = createEventDispatcher();

    /** The shared effect state object (bound from parent) */
    export let globals;

    /** @type {HTMLInputElement} */
    let presetImport;

    function onInputChange() {
        dispatch("change");
    }

    function onPresetSelected(preset) {
        dispatch("preset", preset);
    }
</script>

<div id="guicontainer">
    <div class="preset-bar">
        <input bind:this={presetImport} type="file" accept="application/json" style:display="none"
            on:change={() => {
                let file = presetImport.files[0];
                let fR = new FileReader();
                fR.addEventListener("loadend", (e) => {
                    onPresetSelected(e.target.result);
                });
                fR.readAsText(file);
            }} />
        <select class="ygui-input" style:width="calc(100% - 30px)" style:text-align="center" style:font-size="14px" style:margin-bottom="5px"
            on:change={(e) => {
                if (e.target.value === "IMPORT_FROM_COMPUTER") {
                    presetImport.click();
                } else {
                    onPresetSelected(e.target.value);
                }
                e.target.value = "nothing";
            }}>
            <option selected hidden value="nothing">Use a Preset</option>
            <option value="IMPORT_FROM_COMPUTER">Import from Computer</option>
            <optgroup label="Built-in presets">
                <option value={defaultPreset}>Default</option>
                <option value={softHazePreset}>Soft Haze</option>
                <option value={jediPreset}>Jedi</option>
                <option value={cinematicPreset}>Cinematic</option>
                <option value={sunsetPreset}>Sunset</option>
            </optgroup>
        </select>
        <br />
        <button class="preset-export-btn"
            on:click={() => exportPreset(globals)}>
            Export Preset
        </button>
    </div>
    <table style:width="100%" class="ygui-table">
        <tr>
            <td><label for="threshold" class="ygui-label">Threshold</label></td>
            <td style:width="143px">
                <input type="range" min="0" max="254" step="1" bind:value={globals.threshold} on:input={onInputChange} />
                <input type="number" id="threshold" class="ygui-input" min="0" max="254" step="1"
                    bind:value={globals.threshold} on:input={onInputChange} />
            </td>
        </tr>
        <tr>
            <td><label for="glowLayers" class="ygui-label">Depth</label></td>
            <td>
                <input type="range" min="1" max="24" step="1" bind:value={globals.glowLayers} on:input={onInputChange} />
                <input type="number" id="glowLayers" class="ygui-input" min="1" max="24" step="1"
                    bind:value={globals.glowLayers} on:input={onInputChange} />
            </td>
        </tr>
        <tr>
            <td><label for="glowRadius" class="ygui-label">Radius</label></td>
            <td>
                <input type="range" min="0" max="12" step="0.1" bind:value={globals.glowRadius} on:input={onInputChange} />
                <input type="number" id="glowRadius" class="ygui-input" min="0" max="12" step="0.1"
                    bind:value={globals.glowRadius} on:input={onInputChange} />
            </td>
        </tr>
        <tr>
            <td><label for="colorize" class="ygui-label">Colorize?</label></td>
            <td>
                <input type="checkbox" id="colorize" class="ygui-input"
                    bind:checked={globals.colorize} on:change={onInputChange} />
            </td>
        </tr>
        <tr style:opacity={globals.colorize ? "1" : "0.5"}>
            <td><label for="tintcolor" class="ygui-label"> - Color</label></td>
            <td>
                <input type="color" id="tintcolor" class="ygui-input" disabled={!globals.colorize}
                    bind:value={globals.tintcolor} on:input={onInputChange} />
            </td>
        </tr>
        <tr style:opacity={globals.colorize ? "1" : "0.5"}>
            <td><label for="tintopacity" class="ygui-label"> - Opacity</label></td>
            <td>
                <input type="range" min="0" max="100" step="1" disabled={!globals.colorize} bind:value={globals.tintopacity}
                    on:input={onInputChange} />
                <input type="number" id="tintopacity" class="ygui-input" min="0" max="100" step="1" disabled={!globals.colorize}
                    bind:value={globals.tintopacity} on:input={onInputChange} />
            </td>
        </tr>
        <tr>
            <td><label for="brightness" class="ygui-label">Brightness</label></td>
            <td>
                <input type="range" min="0" max="200" step="1" bind:value={globals.brightness} on:input={onInputChange} />
                <input type="number" id="brightness" class="ygui-input" min="0" max="200" step="1"
                    bind:value={globals.brightness} on:input={onInputChange} />
            </td>
        </tr>
        <tr>
            <td><label for="saturation" class="ygui-label">Saturation</label></td>
            <td>
                <input type="range" min="0" max="100" step="1" bind:value={globals.saturation} on:input={onInputChange} />
                <input type="number" id="saturation" class="ygui-input" min="0" max="100" step="1"
                    bind:value={globals.saturation} on:input={onInputChange} />
            </td>
        </tr>
        <tr>
            <td><label for="hue" class="ygui-label">Hue Shift</label></td>
            <td>
                <input type="range" min="-180" max="180" step="1" bind:value={globals.hue} on:input={onInputChange} />
                <input type="number" id="hue" class="ygui-input" min="-180" max="180" step="1"
                    bind:value={globals.hue} on:input={onInputChange} />
            </td>
        </tr>
        <tr>
            <td><label for="anamorph" class="ygui-label">Anamorph</label></td>
            <td>
                <input type="range" min="0" max="10" step="0.5" bind:value={globals.anamorph} on:input={onInputChange} />
                <input type="number" id="anamorph" class="ygui-input" min="0" max="10" step="0.5"
                    bind:value={globals.anamorph} on:input={onInputChange} />
            </td>
        </tr>
        <tr>
            <td><span class="ygui-label">Preview</span></td>
            <td>
                <input type="checkbox" id="showPreview" class="ygui-input"
                    bind:checked={globals.showPreview} on:change={onInputChange} />
            </td>
        </tr>
        <tr style:opacity={globals.showPreview ? "1" : "0.5"}>
            <td><label for="previewMode" class="ygui-label"> - Mode</label></td>
            <td>
                <select id="previewMode" class="ygui-input" disabled={!globals.showPreview}
                    bind:value={globals.previewMode} on:change={onInputChange}>
                    <option value="Full">Full</option>
                    <option value="Glow Only">Glow Only</option>
                    <option value="Mask">Mask</option>
                </select>
            </td>
        </tr>
        <tr style:opacity={globals.showPreview ? "1" : "0.5"}>
            <td><label for="previewQuality" class="ygui-label"> - Quality</label></td>
            <td>
                <input type="range" min="0.1" max="1" step="0.01" bind:value={globals.previewQuality} on:input={onInputChange}
                    disabled={!globals.showPreview} />
                <input type="number" id="previewQuality" class="ygui-input" min="0.1" max="1" step="0.01"
                    bind:value={globals.previewQuality} on:input={onInputChange} disabled={!globals.showPreview} />
            </td>
        </tr>
    </table>
    <slot name="export-buttons" />
</div>

<style>
    #guicontainer {
        width: 250px;
        box-sizing: border-box;
        position: fixed;
        right: 0;
        top: 0;
        height: 100vh;
        padding: 6.9px;
        padding-bottom: 0;
    }

    .preset-bar {
        width: 100%;
        padding-bottom: 15px;
        text-align: center;
        color: whitesmoke;
        font-family: var(--ux-font);
    }

    .preset-export-btn {
        width: calc(100% - 30px);
        text-align: center;
        font-weight: 400;
        text-transform: none;
        background-color: var(--field-color);
        border: 0;
        border-radius: 0;
        letter-spacing: 0;
        font-size: 14px;
        cursor: pointer;
        color: whitesmoke;
        padding: 4px;
        font-family: var(--ux-font);
    }

    .ygui-input {
        background-color: var(--field-color);
        border: 0;
        outline: none !important;
        color: whitesmoke;
        padding: 4px;
        width: 50px;
        text-align: right;
        accent-color: var(--special-color);
        font-family: var(--ux-font);
        vertical-align: middle;
    }

    select.ygui-input {
        width: auto;
        text-align: left;
    }

    input[type="range"] {
        -webkit-appearance: none;
        appearance: none;
        height: 4px;
        vertical-align: middle;
        border-radius: 2px;
        background-color: #393939;
        outline: none;
        accent-color: var(--special-color);
        width: 69px;
        margin-right: 5px;
    }

    input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 100%;
        background-color: var(--special-color);
    }

    input[type="range"]::-webkit-slider-thumb:hover {
        filter: brightness(1.5);
        cursor: pointer;
    }

    input[type="range"]::-moz-range-thumb {
        width: 12px;
        height: 12px;
        border-radius: 100%;
        background-color: var(--special-color);
        outline: none;
        border: 0;
    }

    input[type="range"]::-moz-range-thumb:hover {
        filter: brightness(1.5);
        cursor: pointer;
    }

    .ygui-label {
        color: whitesmoke;
        font-family: var(--ux-font);
        white-space: pre;
    }

    .ygui-table tr td:nth-of-type(2) {
        text-align: right;
    }

    @media only screen and (max-width: 500px) {
        #guicontainer {
            width: 100vw;
            top: 50vh;
            height: 50vh;
            overflow-y: scroll;
        }
        #guicontainer::-webkit-scrollbar {
            width: 6.9px;
        }
        #guicontainer::-webkit-scrollbar-track {
            background-color: #272727;
        }
        #guicontainer::-webkit-scrollbar-thumb {
            background-color: #424242;
        }
        #guicontainer::-webkit-scrollbar-thumb:hover {
            background-color: #343434;
        }
    }
</style>
