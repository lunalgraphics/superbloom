<script>
    import { onMount } from "svelte";
    import { page } from "$app/state";
    import Photopea from "photopea";

    import { renderBloom } from "$lib/bloom.js";
    import { getPresetData, parsePreset } from "$lib/presets.js";
    import Controls from "$lib/components/Controls.svelte";
    import LandingScreen from "$lib/components/LandingScreen.svelte";

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

    function process(options = {}) {
        renderBloom(globals, threshCanv, glowCanv, compCanv, options);
    }

    function onInputChange() {
        if (globals.showPreview && globals.previewMode === "Full") {
            process();
        } else if (globals.showPreview) {
            process({ skipComposite: true });
        }
    }

    function applyPreset(raw) {
        let preset = parsePreset(raw);
        for (let key in preset) {
            globals[key] = preset[key];
        }
        onInputChange();
    }

    function canvDownload(layerOnly = true) {
        let a = document.createElement("a");
        a.href = layerOnly ? glowCanv.toDataURL() : compCanv.toDataURL();
        a.download = globals.imgname + "-superbloomed.png";
        a.click();
    }

    function handleImageLoad(img, filename = "") {
        globals.baseIMG = img;
        globals.imgname = filename;
        img.addEventListener("load", function () {
            threshCanv.width = this.width;
            threshCanv.height = this.height;
            process();
            landingScreenVisible = false;
        });
        img.addEventListener("error", function () {
            alert("Failed to load image. The file may be corrupt or unsupported.");
            globals.baseIMG = null;
        });
    }

    let isPhotopeaPlugin = false;
    let isPhotoshopPlugin = __IS_PHOTOSHOP_PLUGIN__;

    /** @type {Photopea} */
    let pea;

    let landingScreenVisible = true;

    let dragOver = false;

    function handleDrop(e) {
        e.preventDefault();
        dragOver = false;
        let file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) {
            handleFileUpload(file);
        }
    }

    function handleFileUpload(file) {
        let fR = new FileReader();
        fR.addEventListener("loadend", (e) => {
            let image = new Image();
            image.src = e.target.result;
            handleImageLoad(image, file.name.split(".").slice(0, -1).join("."));
        });
        fR.readAsDataURL(file);
    }

    onMount(async () => {
        if (page.url.searchParams.get("isPhotopeaPlugin") === "yessir") {
            pea = new Photopea(window.parent);
            isPhotopeaPlugin = true;

            let blobber = await pea.exportImage("png");

            let img = new Image();
            img.src = URL.createObjectURL(blobber);
            handleImageLoad(img);
        } else if (isPhotoshopPlugin) {
            window.addEventListener("message", (e) => {
                if (typeof e.data === "string") e.data = JSON.parse(e.data);
                if (e.data.type === "sourceImage") {
                    let img = new Image();
                    img.src = e.data.data;
                    handleImageLoad(img);
                } else if (e.data.type === "preset") {
                    applyPreset(e.data.data);
                }
            });

            window.uxpHost.postMessage({
                type: "webViewLoaded",
                data: true,
            });
        }
    });
</script>

<Controls bind:globals
    on:change={onInputChange}
    on:preset={(e) => applyPreset(e.detail)}>
    <div slot="export-buttons" id="exportpanel">
        {#if !isPhotopeaPlugin && !isPhotoshopPlugin}
            <button on:click={() => {
                let previewQualityTemp = globals.previewQuality;
                globals.previewQuality = 1;
                process({
                    onComplete: () => {
                        canvDownload(false);
                        globals.previewQuality = previewQualityTemp;
                    }
                });
            }}>Export Full Image</button>
            <button on:click={() => {
                let previewQualityTemp = globals.previewQuality;
                globals.previewQuality = 1;
                process({
                    skipComposite: true,
                    onComplete: () => {
                        canvDownload(true);
                        globals.previewQuality = previewQualityTemp;
                    }
                });
            }}>Export Bloom Layer</button>
        {:else if isPhotopeaPlugin}
            <button on:click={() => {
                let previewQualityTemp = globals.previewQuality;
                globals.previewQuality = 1;
                process({
                    skipComposite: true,
                    onComplete: async () => {
                        await pea.openFromURL(glowCanv.toDataURL(), true);
                        await pea.runScript(`app.activeDocument.activeLayer.blendMode = "scrn";`);
                        await pea.runScript(`app.activeDocument.activeLayer.name = "SuperBloom";`);
                        globals.previewQuality = previewQualityTemp;
                    }
                });
            }}>Add to Document</button>
        {:else if isPhotoshopPlugin}
            <button on:click={() => {
                let previewQualityTemp = globals.previewQuality;
                globals.previewQuality = 1;
                process({
                    skipComposite: true,
                    onComplete: () => {
                        let imageData = glowCanv.getContext("2d").getImageData(0, 0, glowCanv.width, glowCanv.height);
                        window.uxpHost.postMessage({
                            type: "exportLayer",
                            data: Array.from(imageData.data),
                            metadata: getPresetData(globals),
                        });
                        globals.previewQuality = previewQualityTemp;
                    }
                });

                let style = new CSSStyleSheet();
                style.insertRule("* { cursor: wait !important; }");
                document.adoptedStyleSheets = [...document.adoptedStyleSheets, style];
            }}>Finish</button>
        {/if}
    </div>
</Controls>

<div id="previewSpace"
    role="region"
    aria-label="Image preview and drop zone"
    on:dragover|preventDefault={() => dragOver = true}
    on:dragleave={() => dragOver = false}
    on:drop={handleDrop}
    class:drag-over={dragOver}>
    {#if dragOver}
        <div class="drop-overlay">Drop image here</div>
    {/if}
    {#if globals.baseIMG && !globals.showPreview}
        <img src={globals.baseIMG.src} alt="base layer" id="baseImage" draggable="false" />
    {/if}
    <canvas bind:this={threshCanv} style:display={(globals.showPreview && globals.previewMode === "Mask") ? "block" : "none"}></canvas>
    <canvas bind:this={glowCanv} style:display={(globals.showPreview && globals.previewMode === "Glow Only") ? "block" : "none"}></canvas>
    <canvas bind:this={compCanv} style:display={(globals.showPreview && globals.previewMode === "Full") ? "block" : "none"}></canvas>
</div>

{#if landingScreenVisible}
    <LandingScreen
        isPhotoshopPlugin={isPhotoshopPlugin}
        isPlugin={isPhotopeaPlugin || isPhotoshopPlugin}
        on:upload={(e) => handleFileUpload(e.detail)}
        on:drop={(e) => handleFileUpload(e.detail)} />
{/if}

<style>
    :global(:root) {
        --ux-font: "Open Sans", sans-serif;
        --special-color: #9800B0;
        --field-color: #0F0F0F;
        --bg-color: #1E1E1E;
    }

    :global(body) {
        background-color: var(--bg-color);
        user-select: none;
    }

    #previewSpace {
        position: fixed;
        left: 0;
        top: 0;
        height: 100vh;
        width: calc(100vw - 250px);
        text-align: center;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 25px;
        box-sizing: border-box;
    }

    #previewSpace.drag-over {
        outline: 3px dashed var(--special-color);
        outline-offset: -3px;
    }

    .drop-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.7);
        color: whitesmoke;
        font-family: var(--ux-font);
        font-size: 24px;
        font-weight: 600;
        z-index: 10;
        pointer-events: none;
    }

    canvas, img#baseImage {
        width: 100%;
        height: 100%;
        object-fit: contain;
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

    @media only screen and (max-width: 500px) {
        #previewSpace {
            width: 100vw !important;
            height: 50vh !important;
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
