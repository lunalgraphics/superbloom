<script>
    import bannerImg from "$lib/assets/banner_plain.png";
    import coverartImg from "$lib/assets/coverart.jpg";
    import { onMount } from "svelte";
    import isolateHighlights from "$lib/scripts/isolate-highlights-gpu.js";
    import WebGLRenderer from "$lib/webgl-renderer.js";
    import { page } from "$app/state";
    import Photopea from "photopea";

    import defaultPreset from "$lib/presets/default.json?raw";
    import softHazePreset from "$lib/presets/soft-haze.json?raw";
    import jediPreset from "$lib/presets/jedi.json?raw";
    import cinematicPreset from "$lib/presets/cinematic.json?raw";
    import sunsetPreset from "$lib/presets/sunset.json?raw";

    import { fly } from "svelte/transition";

    let globals = {
        threshold: 222,
        glowLayers: 16,
        glowRadius: 1,
        colorize: false,
        tintcolor: "#FF5500",
        showPreview: true,
        previewMode: "Full",
        imgname: "",
        saturation: 100,
        hue: 0,
        tintopacity: 100,
        brightness: 100,
        previewQuality: 0.45,
        anamorph: 0,
    };

    /** @type {HTMLCanvasElement} */
    let threshCanv;
    /** @type {HTMLCanvasElement} */
    let glowCanv;
    /** @type {HTMLCanvasElement} */
    let compCanv;

    // GPU acceleration
    let webglRenderer = null;
    let useGPUAcceleration = true;
    let processingTime = 0;
    let webglCanvas = null;


    function mainProcess(inputData=globals, callback=() => {}, layerOnly=false) {
        if (typeof inputData == "string") {
            inputData = JSON.parse(inputData);
        }

        // Try GPU acceleration first
        if (useGPUAcceleration) {
            try {
                return mainProcessGPU(inputData, callback, layerOnly);
            } catch (error) {
                console.warn('GPU acceleration failed, falling back to CPU:', error.message);
                console.warn('Error details:', error);
                useGPUAcceleration = false;
                // Clean up failed WebGL renderer
                if (webglRenderer) {
                    webglRenderer.cleanup();
                    webglRenderer = null;
                }
            }
        }

        // Fallback to CPU processing
        return mainProcessCPU(inputData, callback, layerOnly);
    }

    function mainProcessGPU(inputData, callback, layerOnly) {
        const startTime = performance.now();
        
        // Initialize WebGL renderer if needed
        if (!webglRenderer) {
            console.log('Initializing WebGL renderer...');
            
            // Create a dedicated WebGL canvas (offscreen)
            if (!webglCanvas) {
                webglCanvas = document.createElement('canvas');
            }
            
            webglRenderer = new WebGLRenderer();
            try {
                webglRenderer.init(webglCanvas);
                console.log('WebGL renderer initialized successfully');
            } catch (error) {
                console.error('Failed to initialize WebGL renderer:', error.message);
                throw error;
            }
        }

        // Validate input data
        if (!inputData.baseIMG || !inputData.baseIMG.width || !inputData.baseIMG.height) {
            throw new Error('Invalid input image data');
        }

        // Set canvas dimensions
        const width = Math.floor(inputData.baseIMG.width * inputData.previewQuality);
        const height = Math.floor(inputData.baseIMG.height * inputData.previewQuality);
        
        if (width <= 0 || height <= 0) {
            throw new Error('Invalid canvas dimensions');
        }
        
        console.log(`GPU processing: ${width}x${height} (quality: ${inputData.previewQuality})`);
        
        // Set WebGL canvas size
        webglCanvas.width = width;
        webglCanvas.height = height;
        
        // Set display canvas dimensions
        threshCanv.width = width;
        threshCanv.height = height;
        glowCanv.width = width;
        glowCanv.height = height;
        compCanv.width = width;
        compCanv.height = height;

        // Process using GPU
        webglRenderer.process(inputData, () => {
            try {
                // Copy GPU results back to canvases for display
                copyGPUResultsToCanvases(width, height);
                
                processingTime = performance.now() - startTime;
                console.log(`GPU processing completed in ${processingTime.toFixed(2)}ms`);
                
                callback();
            } catch (error) {
                console.error('Failed to copy GPU results:', error.message);
                throw error;
            }
        });
    }

    function copyGPUResultsToCanvases(width, height) {
        try {
            // Copy threshold result
            const thresholdData = webglRenderer.getImageData('threshold');
            if (thresholdData && thresholdData.data) {
                const ctx = threshCanv.getContext('2d');
                const clampedArray = new Uint8ClampedArray(thresholdData.data);
                const imageData = new ImageData(clampedArray, width, height);
                ctx.putImageData(imageData, 0, 0);
            }

            // Copy glow result
            const glowData = webglRenderer.getImageData('glow');
            if (glowData && glowData.data) {
                const ctx2 = glowCanv.getContext('2d');
                const clampedArray = new Uint8ClampedArray(glowData.data);
                const imageData = new ImageData(clampedArray, width, height);
                ctx2.putImageData(imageData, 0, 0);
            }

            // Copy composite result to 2D canvas
            const compositeData = webglRenderer.getImageData('composite');
            if (compositeData && compositeData.data) {
                // Ensure we can get a 2D context (reset canvas if needed)
                const ctx3 = compCanv.getContext('2d');
                if (ctx3) {
                    const clampedArray = new Uint8ClampedArray(compositeData.data);
                    const imageData = new ImageData(clampedArray, width, height);
                    ctx3.putImageData(imageData, 0, 0);
                } else {
                    console.warn('Cannot get 2D context for compCanv, creating new canvas element');
                    // If we can't get 2D context, the canvas was used for WebGL
                    // We need to replace it or use a different approach
                    const newCanvas = document.createElement('canvas');
                    newCanvas.width = width;
                    newCanvas.height = height;
                    const newCtx = newCanvas.getContext('2d');
                    const clampedArray = new Uint8ClampedArray(compositeData.data);
                    const imageData = new ImageData(clampedArray, width, height);
                    newCtx.putImageData(imageData, 0, 0);
                    
                    // Replace the canvas content by copying from the new canvas
                    compCanv.width = width;
                    compCanv.height = height;
                    const ctx = compCanv.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(newCanvas, 0, 0);
                    }
                }
            }
            
        } catch (error) {
            console.error('Error copying GPU results to canvases:', error.message);
            throw error;
        }
    }

    function mainProcessCPU(inputData, callback, layerOnly) {
        const startTime = performance.now();
        
        threshCanv.width = inputData.baseIMG.width * inputData.previewQuality;
        threshCanv.height = inputData.baseIMG.height * inputData.previewQuality;
        
        var ctx = threshCanv.getContext("2d");
        ctx.restore();
        ctx.drawImage(inputData.baseIMG, 0, 0, threshCanv.width, threshCanv.height);
        ctx.save();

        if (inputData.threshold < 255) {
            isolateHighlights(ctx, inputData.threshold);
        }
        else {
            ctx.fillRect(0, 0, threshCanv.width, threshCanv.height);
        }

        if (inputData.colorize) {
            ctx.restore();
            ctx.save();
            ctx.globalAlpha = inputData.tintopacity / 100;
            ctx.fillStyle = inputData.tintcolor;
            ctx.globalCompositeOperation = "color";
            ctx.fillRect(0, 0, threshCanv.width, threshCanv.height);
            ctx.globalCompositeOperation = "multiply";
            ctx.fillRect(0, 0, threshCanv.width, threshCanv.height);
        }
        
        glowCanv.width = threshCanv.width;
        glowCanv.height = threshCanv.height;
        var ctx2 = glowCanv.getContext("2d");
        ctx2.clearRect(0, 0, glowCanv.width, glowCanv.height);
        ctx2.save();

        for (var i = 1; i < inputData.glowLayers; i++) {
            var blurRadius = (i + 1) ** 2 * inputData.glowRadius * inputData.previewQuality;
            ctx2.restore();
            ctx2.save();
            ctx2.filter = `brightness(${inputData.brightness}%) hue-rotate(${inputData.hue}deg) saturate(${inputData.saturation}%) blur(${blurRadius}px)`;
            ctx2.globalCompositeOperation = "screen";
            ctx2.drawImage(threshCanv, 0, 0, glowCanv.width / (inputData.anamorph + 1), glowCanv.height);
        }
        
        ctx2.restore();
        ctx2.drawImage(glowCanv, 0, 0, glowCanv.width * (inputData.anamorph + 1), glowCanv.height);

        if (layerOnly) {
            processingTime = performance.now() - startTime;
            console.log(`CPU processing completed in ${processingTime.toFixed(2)}ms`);
            callback();
            return;
        }

        compCanv.width = threshCanv.width;
        compCanv.height = threshCanv.height;
        let ctx3 = compCanv.getContext("2d");
        ctx3.restore();
        ctx3.save();
        ctx3.clearRect(0, 0, compCanv.width, compCanv.height);
        ctx3.drawImage(inputData.baseIMG, 0, 0, compCanv.width, compCanv.height);
        ctx3.globalCompositeOperation = "screen";
        ctx3.drawImage(glowCanv, 0, 0, compCanv.width, compCanv.height);
        ctx3.restore();
        ctx3.save();

        processingTime = performance.now() - startTime;
        console.log(`CPU processing completed in ${processingTime.toFixed(2)}ms`);
        callback();
    }

    function onInputChange() {
        if (globals.showPreview && globals.previewMode == "Full") mainProcess(globals);
        else if (globals.showPreview && globals.previewMode == "Glow Only") mainProcess(globals, () => {  }, true);
        else if (globals.showPreview && globals.previewMode == "Mask") mainProcess(globals, () => {  }, true);
    }

    /** @type {HTMLInputElement} */
    let imgUpload;

    function canvDownload(layerOnly=true) {
        var a = document.createElement("a");
        if (layerOnly) a.href = glowCanv.toDataURL();
        else a.href = compCanv.toDataURL();
        a.download = globals.imgname + "-superbloomed.png";
        a.click();
    }

    let isPhotopeaPlugin = false, isPhotoshopPlugin = false;

    /** @type {Photopea} */
    let pea;

    let landingScreenVisible = true;

    function getPresetData() {
        let preset = Object.assign({}, globals);
        delete preset.baseIMG;
        delete preset.imgname;
        delete preset.showPreview;
        delete preset.previewMode;
        delete preset.previewQuality;
        return JSON.stringify(preset);
    }

    function exportPreset() {
        let blobber = new Blob([getPresetData()], { type: "application/json" });

        let a = document.createElement("a");
        a.href = URL.createObjectURL(blobber);
        a.download = "superbloom-preset.json";
        a.click();
    }

    function applyPreset(preset) {
        if (typeof preset == "string") preset = JSON.parse(preset);
        for (let key in preset) {
            globals[key] = preset[key];
        }
        onInputChange();
    }

    /** @type {HTMLInputElement} */
    let presetImport;

    onMount(async () => {
        if (page.url.searchParams.get("isPhotopeaPlugin") == "yessir") {
            pea = new Photopea(window.parent);
            isPhotopeaPlugin = true;

            let blobber = await pea.exportImage("png");
            
            var img = new Image();
            img.addEventListener("load", function() {
                threshCanv.width = this.width;
                threshCanv.height = this.height;
                mainProcess(globals);
                landingScreenVisible = false;
            });
            img.src = URL.createObjectURL(blobber);
            globals.baseIMG = img;
        }
        else if (page.url.searchParams.get("isPhotoshopPlugin") == "yeah") {
            isPhotoshopPlugin = true;
            console.log("hi photoshop");

            window.addEventListener("message", (e) => {
                if (typeof e.data == "string") e.data = JSON.parse(e.data);
                console.log(e);
                if (e.data.type == "sourceImage") {
                    let img = new Image();
                    img.addEventListener("load", function() {
                        threshCanv.width = this.width;
                        threshCanv.height = this.height;
                        mainProcess(globals);
                        landingScreenVisible = false;
                    });
                    img.src = e.data.data;
                    globals.baseIMG = img;
                }
                else if (e.data.type === "preset") {
                    applyPreset(e.data.data);
                }
            });

            window.uxpHost.postMessage({
                type: "webViewLoaded",
                data: true,
            });
            console.log("webview loaded");
        }
    });
</script>


<div id="guicontainer">
    <div style:width="100%" style:padding-bottom="15px" style:text-align="center"
        style:color="whitesmoke" style:font-family="var(--ux-font)">
        <input bind:this={presetImport} type="file" accept="application/json" style:display="none"
            on:change={() => {
                let file = presetImport.files[0];
                let fR = new FileReader();
                fR.addEventListener("loadend", (e) => {
                    applyPreset(e.target.result);
                });
                fR.readAsText(file);
            }} />
        <select class="ygui-input" style:width="calc(100% - 30px)" style:text-align="center" style:font-size="14px"
            on:change={(e) => {
                if (e.target.value == "IMPORT_FROM_COMPUTER") {
                    presetImport.click();
                }
                else {
                    applyPreset(e.target.value);
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
        <br uh />
        <button class="ygui-input" style:width="calc(100% - 30px)" style:text-align="center"
            style:font-weight="400" style:text-transform="none" style:background-color="var(--field-color)!important"
            style:border-radius="0" style:letter-spacing="0" style:font-size="14px"
            style:cursor="pointer" on:click={exportPreset}>
            Export Preset
        </button>
    </div>
    <table style:width="100%" class="ygui-table">
        <tr>
            <td>
                <label for="threshold" class="ygui-label">Threshold</label>
            </td>
            <td style:width="143px">
                <input type="range" min="0" max="254" step="1" bind:value={globals.threshold} on:input={onInputChange}
                    style:accent-color="var(--special-color)" style:width="69px" style:margin-right="5px" />
                <input type="number" id="threshold" class="ygui-input" min="0" max="254" step="1"
                    bind:value={globals.threshold} on:input={onInputChange} />
            </td>
        </tr>
        <tr>
            <td>
                <label for="glowLayers" class="ygui-label">Depth</label>
            </td>
            <td>
                <input type="range" min="1" max="24" step="1" bind:value={globals.glowLayers} on:input={onInputChange}
                    style:accent-color="var(--special-color)" style:width="69px" style:margin-right="5px" />
                <input type="number" id="glowLayers" class="ygui-input" min="1" max="24" step="1"
                    bind:value={globals.glowLayers} on:input={onInputChange} />
            </td>
        </tr>
        <tr>
            <td>
                <label for="glowRadius" class="ygui-label">Radius</label>
            </td>
            <td>
                <input type="range" min="0" max="12" step="0.1" bind:value={globals.glowRadius} on:input={onInputChange}
                    style:accent-color="var(--special-color)" style:width="69px" style:margin-right="5px" />
                <input type="number" id="glowRadius" class="ygui-input" min="0" max="12" step="0.1"
                    bind:value={globals.glowRadius} on:input={onInputChange} />
            </td>
        </tr>
        <tr>
            <td>
                <label for="colorize" class="ygui-label">Colorize?</label>
            </td>
            <td>
                <input type="checkbox" id="colorize" class="ygui-input"
                    bind:checked={globals.colorize} on:change={onInputChange} />
            </td>
        </tr>
        <tr style:opacity={globals.colorize ? "1" : "0.5"}>
            <td>
                <label for="tintcolor" class="ygui-label"> - Color</label>
            </td>
            <td>
                <input type="color" id="tintcolor" class="ygui-input" disabled={!globals.colorize}
                    bind:value={globals.tintcolor} on:input={onInputChange} />
            </td>
        </tr>
        <tr style:opacity={globals.colorize ? "1" : "0.5"}>
            <td>
                <label for="tintopacity" class="ygui-label"> - Opacity</label>
            </td>
            <td>
                <input type="range" min="0" max="100" step="1" disabled={!globals.colorize} bind:value={globals.tintopacity}
                    on:input={onInputChange} style:accent-color="var(--special-color)" style:width="69px" style:margin-right="5px" />
                <input type="number" id="tintopacity" class="ygui-input" min="0" max="100" step="1" disabled={!globals.colorize}
                    bind:value={globals.tintopacity} on:input={onInputChange} />
            </td>
        </tr>
        <tr>
            <td>
                <label for="brightness" class="ygui-label">Brightness</label>
            </td>
            <td>
                <input type="range" min="0" max="200" step="1" bind:value={globals.brightness} on:input={onInputChange}
                    style:accent-color="var(--special-color)" style:width="69px" style:margin-right="5px" />
                <input type="number" id="brightness" class="ygui-input" min="0" max="200" step="1"
                    bind:value={globals.brightness} on:input={onInputChange} />
            </td>
        </tr>
        <tr>
            <td>
                <label for="saturation" class="ygui-label">Saturation</label>
            </td>
            <td>
                <input type="range" min="0" max="100" step="1" bind:value={globals.saturation} on:input={onInputChange}
                    style:accent-color="var(--special-color)" style:width="69px" style:margin-right="5px" />
                <input type="number" id="saturation" class="ygui-input" min="0" max="100" step="1"
                    bind:value={globals.saturation} on:input={onInputChange} />
            </td>
        </tr>
        <tr>
            <td>
                <label for="hue" class="ygui-label">Hue Shift</label>
            </td>
            <td>
                <input type="range" min="-180" max="180" step="1" bind:value={globals.hue} on:input={onInputChange}
                    style:accent-color="var(--special-color)" style:width="69px" style:margin-right="5px" />
                <input type="number" id="hue" class="ygui-input" min="-180" max="180" step="1"
                    bind:value={globals.hue} on:input={onInputChange} />
            </td>
        </tr>
        <tr>
            <td>
                <label for="anamorph" class="ygui-label">Anamorph</label>
            </td>
            <td>
                <input type="range" min="0" max="10" step="0.5" bind:value={globals.anamorph} on:input={onInputChange}
                    style:accent-color="var(--special-color)" style:width="69px" style:margin-right="5px" />
                <input type="number" id="anamorph" class="ygui-input" min="0" max="10" step="0.5"
                    bind:value={globals.anamorph} on:input={onInputChange} />
            </td>
        </tr>
        <tr>
            <td>
                <label for="useGPU" class="ygui-label">GPU Acceleration</label>
            </td>
            <td>
                <input type="checkbox" id="useGPU" class="ygui-input"
                    bind:checked={useGPUAcceleration} on:change={onInputChange} />
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
            <td>
                <label for="previewMode" class="ygui-label"> - Mode</label>
            </td>
            <td>
                <select id="previewMode" class="ygui-input" type="select" disabled={!globals.showPreview}
                    bind:value={globals.previewMode} on:change={onInputChange}>
                    <option value="Full">Full</option>
                    <option value="Glow Only">Glow Only</option>
                    <option value="Mask">Mask</option>
                </select>
            </td>
        </tr>
        <tr style:opacity={globals.showPreview ? "1" : "0.5"}>
            <td>
                <label for="previewQuality" class="ygui-label"> - Quality</label>
            </td>
            <td>
                <input type="range" min="0.1" max="1" step="0.01" bind:value={globals.previewQuality} on:input={onInputChange}
                    style:accent-color="var(--special-color)" style:width="69px" style:margin-right="5px" disabled={!globals.showPreview} />
                <input type="number" id="previewQuality" class="ygui-input" min="0.1" max="1" step="0.01"
                    bind:value={globals.previewQuality} on:input={onInputChange} disabled={!globals.showPreview} />
            </td>
        </tr>
    </table>
    <div id="exportpanel">
        {#if !isPhotopeaPlugin && !isPhotoshopPlugin}
            <button id="exportButton" on:click={() => {
                let previewQualityTemp = globals.previewQuality;
                globals.previewQuality = 1;
                mainProcess(globals, () => {
                    canvDownload(false);
                    globals.previewQuality = previewQualityTemp;
                }, false);
            }}>Export Full Image</button>
            <button id="exportButtonLayer" on:click={() => {
                let previewQualityTemp = globals.previewQuality;
                globals.previewQuality = 1;
                mainProcess(globals, () => {
                    canvDownload(true);
                    globals.previewQuality = previewQualityTemp;
                }, true);
            }}>Export Bloom Layer</button>
        {:else if isPhotopeaPlugin}
            <button id="exportButton" on:click={() => {
                let previewQualityTemp = globals.previewQuality;
                globals.previewQuality = 1;
                mainProcess(globals, async function() {
                    await pea.openFromURL(glowCanv.toDataURL(), true);
                    await pea.runScript(`app.activeDocument.activeLayer.blendMode = "scrn";`);
                    await pea.runScript(`app.activeDocument.activeLayer.name = "SuperBloom";`);
                    globals.previewQuality = previewQualityTemp;
                }, true);
            }}>Add to Document</button>
        {:else if isPhotoshopPlugin}
            <button id="exportButton" on:click={() => {
                let previewQualityTemp = globals.previewQuality;
                globals.previewQuality = 1;
                mainProcess(globals, async function() {
                    let imageData = glowCanv.getContext("2d").getImageData(0, 0, glowCanv.width, glowCanv.height);
                    window.uxpHost.postMessage({
                        type: "exportLayer",
                        data: Array.from(imageData.data),
                        metadata: getPresetData(),
                    });
                    globals.previewQuality = previewQualityTemp;
                }, true);

                let style = new CSSStyleSheet();
                style.insertRule("* { cursor: wait !important; }");
                document.adoptedStyleSheets = [...document.adoptedStyleSheets, style];
            }}>Finish</button>
        {/if}
    </div>
</div>
<div style="position: fixed; left: 0; top: 0; height: 100vh; width: calc(100vw - 250px); text-align: center;" id="previewSpace"
    style:display="flex" style:justify-content="center" style:align-items="center" style:padding="25px" style:box-sizing="border-box">
    {#if globals.baseIMG && !globals.showPreview}
        <img src={globals.baseIMG.src} alt="base layer" id="baseImage" draggable="false" style:display="block" />
    {/if}
    <canvas bind:this={threshCanv} style:display={(globals.showPreview && globals.previewMode == "Mask") ? "block" : "none"}></canvas>
    <canvas bind:this={glowCanv} style:display={(globals.showPreview && globals.previewMode == "Glow Only") ? "block" : "none"}></canvas>
    <canvas bind:this={compCanv} style:display={(globals.showPreview && globals.previewMode == "Full") ? "block" : "none"}></canvas>
</div>
{#if landingScreenVisible}
    <div id="landingscreen">
        <div style="position: absolute; width: 500px; right: 0; top: 0; height: 100vh;" id="lsRight">
            <div class="centeredblock" style="text-align: center;">
                <input type="file" accept="image/*"
                    bind:this={imgUpload} style:display="none"
                    on:change={() => {
                        let file = imgUpload.files[0];
                        let fR = new FileReader();
                        fR.addEventListener("loadend", (e) => {
                            let image = new Image();
                            image.src = e.target.result;
                            globals.baseIMG = image;
                            image.addEventListener("load", function() {
                                threshCanv.width = this.width;
                                threshCanv.height = this.height;
                                mainProcess(globals);
                                landingScreenVisible = false;
                            });
                        });
                        fR.readAsDataURL(file);
                        
                        globals.imgname = file.name.split(".").slice(0, -1).join(".");
                    }} />
                
                <div style:position="relative" style:width="calc(min(512px, 100vw))" style:height="100px">
                    {#each new Array(6).fill(0) as _, i}
                        <img src={bannerImg} alt="SuperBloom" width="100%" draggable="false"
                            style:position="absolute" style:top="0" style:left="0"
                            style:filter="blur({(i) ** 2 * 3}px)" style:mix-blend-mode="screen" />
                    {/each}
                </div>
                <br />
                {#if !isPhotopeaPlugin && !isPhotoshopPlugin}
                    <button id="uploadButton" on:click={() => {
                        imgUpload.click();
                    }}>Upload Image</button>
                {:else if isPhotoshopPlugin}
                    <div style:width="42px" style:height="42px" style:border-radius="100%"
                        style:border="4px solid grey" style:border-top-color="deepskyblue"
                        style:animation="spin 1s linear infinite" style:margin="8px"
                        style:display="inline-block"></div>
                {/if}
            </div>
            
            <div id="creditsbox">
                Copyright (c) 2025 Lunal Graphics<br />
                Developed by Yikuan Sun
            </div>
        </div>
        <div style="position: absolute; width: calc(100vw - 500px); left: 0; top: 0; height: 100vh; background-image: url('{coverartImg}'); background-size: cover; background-position: center;"></div>
    </div>
{/if}

<style>
    :global(:root) {
        --ux-font: "Open Sans", sans-serif;
        --special-color: #9800B0;
        --field-color: #0F0F0F;
        --bg-color: #1E1E1E;
    }

    #landingscreen {
        position: fixed;
        background-color: var(--bg-color);
        z-index: 69;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
    }

    :global(body) {
        background-color: var(--bg-color);
        user-select: none;
    }

    .centeredblock {
        position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    }

    canvas, img#baseImage {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }

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

    #exportpanel {
        width: 100%;
        box-sizing: border-box;
        text-align: center;
        padding-top: 15px;
        position: sticky;
        bottom: 0;
        background-color: var(--bg-color);
        padding-bottom: 6.9px;
    }

    .ygui-input {
        background-color: var(--field-color);
        border: 0;
        outline: none!important;
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

    button {
        font-family: var(--ux-font);
        color: whitesmoke;
        background-color: var(--special-color);
        border: 0;
        border-radius: 3.4px;
        padding: 8px 16px;
        margin: 5px;
        transition: background-color 0.2s;
        text-transform: uppercase;
        font-weight: 650;
        letter-spacing: 0.650px;
        font-size: 12.3px;
    }

    button:hover {
        background-color: #4B0057;
    }

    #creditsbox {
        position: absolute;
        width: 100%;
        bottom: 25px;
        left: 0;
        text-align: center;
        color: whitesmoke;
        font-family: var(--ux-font);
        font-size: 10px;
    }

    @media only screen and (max-width: 500px) {
        #lsRight {
            width: 100vw!important;
        }
        
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
        
        #previewSpace {
            width: 100vw!important;
            height: 50vh!important;
        }
    }

    @keyframes -global-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
</style>

<svelte:head>
    <title>SuperBloom</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap" rel="stylesheet" />
</svelte:head>