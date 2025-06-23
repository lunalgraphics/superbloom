<script>
    import bannerImg from "$lib/assets/banner_plain.png";
    import coverartImg from "$lib/assets/coverart.jpg";
    import { onMount } from "svelte";
    import main from "$lib/scripts/main.js";
    import sliders from "$lib/scripts/sliders.js";
    import plugin from "$lib/scripts/plugin.js";
    import isolateHighlights from "$lib/scripts/isolate-highlights.js";

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
    };

    /** @type {HTMLCanvasElement} */
    let threshCanv;
    /** @type {HTMLCanvasElement} */
    let finalCanv;

    let loading = false;

    function mainProcess(inputData=globals, callback=() => {}, layerOnly=false) {
        loading = true;
        if (typeof inputData == "string") {
            inputData = JSON.parse(inputData);
        }
        
        var ctx = threshCanv.getContext("2d");
        ctx.restore();
        ctx.drawImage(inputData.baseIMG, 0, 0);
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
        
        finalCanv.width = threshCanv.width;
        finalCanv.height = threshCanv.height;
        var ctx2 = finalCanv.getContext("2d");

        for (var i = 1; i < inputData.glowLayers; i++) {
            var blurRadius = (i + 1) ** 2 * inputData.glowRadius;
            ctx2.restore();
            ctx2.save();
            ctx2.filter = `brightness(${inputData.brightness}%) hue-rotate(${inputData.hue}deg) saturate(${inputData.saturation}%) blur(${blurRadius}px)`;
            ctx2.globalCompositeOperation = "screen";
            ctx2.drawImage(threshCanv, 0, 0);
        }

        if (layerOnly) {
            callback();
            loading = false;
            return;
        }

        ctx2.restore();
        ctx2.save();
        ctx2.globalCompositeOperation = "screen";
        ctx2.drawImage(inputData.baseIMG, 0, 0);

        callback();
        loading = false;
        
    }

    function onInputChange() {
        if (globals.showPreview == "Full") mainProcess(globals);
        else if (globals.showPreview == "Glow Only") mainProcess(globals, function() {  }, true);
        else {
            mainProcess({
                baseIMG: globals.baseIMG,
                threshold: 255,
                glowLayers: 0,
                glowRadius: 0,
                colorize: false,
                tintcolor: "#000000",
                saturation: 100,
                hue: 0,
                tintopacity: 100,
                brightness: 100,
            });
        }
    }

    /** @type {HTMLInputElement} */
    let imgUpload;

    onMount(() => {
        //main();
        //sliders();
        //plugin();
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
                <label for="showPreview" class="ygui-label">Preview</label>
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

    </table>
</div>
<div style="position: fixed; left: 0; top: 0; height: 100vh; width: calc(100vw - 250px); text-align: center;" id="previewSpace">
    <div class="centeredblock">
        <canvas bind:this={threshCanv} style:display="none"></canvas>
        <canvas bind:this={finalCanv}></canvas>
    </div>
</div>
{#if loading}
    <div id="waitCover"></div>
{/if}
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
                            document.querySelector("canvas").width = this.width;
                            document.querySelector("canvas").height = this.height;
                            mainProcess(globals);
                            document.querySelector("#landingscreen").style.display = "none";
                        });
                    });
                    fR.readAsDataURL(file);
                    
                    globals.imgname = file.name.split(".").slice(0, -1).join(".");
                }} />
            
            <img src={bannerImg} alt="SuperBloom" width="512px" draggable="false" />
            <br />
            <button id="uploadButton" on:click={() => {
                imgUpload.click();
            }}>Upload Image</button>
        </div>
        
        <div id="creditsbox">
            Copyright (c) 2022 Lunal Graphics<br />
            Developed by Yikuan Sun
        </div>
    </div>
    <div style="position: absolute; width: calc(100vw - 500px); left: 0; top: 0; height: 100vh; background-image: url('{coverartImg}'); background-size: cover; background-position: center;"></div>
</div>

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

    canvas {
        max-width: calc(100vw - 300px);
        max-height: calc(100vh - 50px);
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

    :global(#exportpanel) {
        width: 100%;
        box-sizing: border-box;
        text-align: center;
    }

    #waitCover {
        cursor: wait;
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 100;
    }

    :global(.ygui-input) {
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

    :global(select.ygui-input) {
        width: auto!important;
        text-align: left;
    }

    :global(.ygui-label) {
        color: whitesmoke;
        font-family: var(--ux-font);
        white-space: pre;
    }

    :global(.ygui-table tr td:nth-of-type(2)) {
        text-align: right;
    }

    :global(button) {
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

    :global(button:hover) {
        background-color: #4B0057;
    }

    :global(#exportpanel) {
        padding-top: 15px;
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
        canvas {
            max-width: calc(100vw - 50px)!important;
            max-height: calc(70vh - 50px)!important;
        }
    }
</style>

<svelte:head>
    <title>SuperBloom</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap" rel="stylesheet" />
</svelte:head>