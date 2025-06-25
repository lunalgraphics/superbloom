<script>
    import bannerImg from "$lib/assets/banner_plain.png";
    import coverartImg from "$lib/assets/coverart.jpg";
    import { onMount } from "svelte";
    import isolateHighlights from "$lib/scripts/isolate-highlights.js";
    import { page } from "$app/state";
    import Photopea from "photopea";

    let globals = {
        threshold: 222,
        glowLayers: 16,
        glowRadius: 1,
        colorize: false,
        tintcolor: "#FF5500",
        showPreview: "Full",
        imgname: "",
        saturation: 100,
        hue: 0,
        tintopacity: 100,
        brightness: 100,
        previewQuality: 0.75,
        anamorph: 0,
    };

    /** @type {HTMLCanvasElement} */
    let threshCanv;
    /** @type {HTMLCanvasElement} */
    let glowCanv;
    /** @type {HTMLCanvasElement} */
    let compCanv;


    function mainProcess(inputData=globals, callback=() => {}, layerOnly=false) {
        if (typeof inputData == "string") {
            inputData = JSON.parse(inputData);
        }

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

        callback();
        
    }

    function onInputChange() {
        if (globals.showPreview == "Full") mainProcess(globals);
        else if (globals.showPreview == "Glow Only") mainProcess(globals, () => {  }, true);
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

    let isPhotopeaPlugin = false;

    /** @type {Photopea} */
    let pea;

    let landingScreenVisible = true;

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
    });
</script>


<div id="guicontainer">
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
                <input type="range" min="1" max="30" step="1" bind:value={globals.glowLayers} on:input={onInputChange}
                    style:accent-color="var(--special-color)" style:width="69px" style:margin-right="5px" />
                <input type="number" id="glowLayers" class="ygui-input" min="1" max="30" step="1"
                    bind:value={globals.glowLayers} on:input={onInputChange} />
            </td>
        </tr>
        <tr>
            <td>
                <label for="glowRadius" class="ygui-label">Radius</label>
            </td>
            <td>
                <input type="range" min="0" max="6" step="0.1" bind:value={globals.glowRadius} on:input={onInputChange}
                    style:accent-color="var(--special-color)" style:width="69px" style:margin-right="5px" />
                <input type="number" id="glowRadius" class="ygui-input" min="0" max="6" step="0.1"
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
            <td colspan="2"><span class="ygui-label">Preview</span></td>
        </tr>
        <tr>
            <td>
                <label for="showPreview" class="ygui-label"> - Mode</label>
            </td>
            <td>
                <select id="showPreview" class="ygui-input" type="select"
                    bind:value={globals.showPreview} on:change={onInputChange}>
                    <option value="Full">Full</option>
                    <option value="None">None</option>
                    <option value="Glow Only">Glow Only</option>
                </select>
            </td>
        </tr>
        <tr>
            <td>
                <label for="previewQuality" class="ygui-label"> - Quality</label>
            </td>
            <td>
                <input type="range" min="0.1" max="1" step="0.01" bind:value={globals.previewQuality} on:input={onInputChange}
                    style:accent-color="var(--special-color)" style:width="69px" style:margin-right="5px" />
                <input type="number" id="previewQuality" class="ygui-input" min="0.1" max="1" step="0.01"
                    bind:value={globals.previewQuality} on:input={onInputChange} />
            </td>
        </tr>
    </table>
    <div id="exportpanel">
        {#if !isPhotopeaPlugin}
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
        {:else}
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
        {/if}
    </div>
</div>
<div style="position: fixed; left: 0; top: 0; height: 100vh; width: calc(100vw - 250px); text-align: center;" id="previewSpace"
    style:display="flex" style:justify-content="center" style:align-items="center" style:padding="25px" style:box-sizing="border-box">
    {#if globals.baseIMG && globals.showPreview == "None"}
        <img src={globals.baseIMG.src} alt="base layer" id="baseImage" draggable="false" style:display="block" />
    {/if}
    <canvas bind:this={threshCanv} style:display="none"></canvas>
    <canvas bind:this={glowCanv} style:display={globals.showPreview == "Glow Only" ? "block" : "none"}></canvas>
    <canvas bind:this={compCanv} style:display={globals.showPreview == "Full" ? "block" : "none"}></canvas>
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
                
                <img src={bannerImg} alt="SuperBloom" width="512px" draggable="false" />
                <br />
                {#if !isPhotopeaPlugin}
                    <button id="uploadButton" on:click={() => {
                        imgUpload.click();
                    }}>Upload Image</button>
                {/if}
            </div>
            
            <div id="creditsbox">
                Copyright (c) 2022 Lunal Graphics<br />
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
    }

    #exportpanel {
        width: 100%;
        box-sizing: border-box;
        text-align: center;
        padding-top: 15px;
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
    }

    select.ygui-input {
        width: auto!important;
        text-align: left;
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
        #lsRight img {
            width: 100vw;
        }
        
        #guicontainer {
            width: 100vw;
            top: 70vh;
            height: 30vh;
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
            height: 70vh!important;
        }
    }
</style>

<svelte:head>
    <title>SuperBloom</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap" rel="stylesheet" />
</svelte:head>