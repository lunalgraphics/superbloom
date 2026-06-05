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

    // --- History (undo/redo) ---
    // Snapshots store only the serializable effect parameters, not UI/runtime state.

    const HISTORY_LIMIT = 50;
    const EFFECT_KEYS = ["threshold","glowLayers","glowRadius","colorize","tintcolor",
                         "saturation","hue","tintopacity","brightness","anamorph"];

    function snapshotParams() {
        let snap = {};
        for (let key of EFFECT_KEYS) snap[key] = globals[key];
        return snap;
    }

    function restoreSnapshot(snap) {
        for (let key of EFFECT_KEYS) globals[key] = snap[key];
        // Trigger Svelte reactivity
        globals = globals;
    }

    let history = [snapshotParams()];
    let historyIndex = 0;

    /** Call after any committed change (mouseup, keyup, preset apply) to push a snapshot. */
    function pushHistory() {
        // Drop any redo states beyond current position
        history = history.slice(0, historyIndex + 1);
        history.push(snapshotParams());
        if (history.length > HISTORY_LIMIT) history.shift();
        historyIndex = history.length - 1;
    }

    function undo() {
        if (historyIndex <= 0) return;
        historyIndex--;
        restoreSnapshot(history[historyIndex]);
        onInputChange();
    }

    function redo() {
        if (historyIndex >= history.length - 1) return;
        historyIndex++;
        restoreSnapshot(history[historyIndex]);
        onInputChange();
    }

    let debounceTimer;

    function onInputChange() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (globals.showPreview && globals.previewMode === "Full") {
                process();
            } else if (globals.showPreview) {
                process({ skipComposite: true });
            }
        }, 30);
    }

    function applyPreset(raw) {
        let preset = parsePreset(raw);
        for (let key in preset) {
            globals[key] = preset[key];
        }
        pushHistory();
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
        resetView();

        function onReady() {
            img.decode().then(() => {
                threshCanv.width = img.width;
                threshCanv.height = img.height;
                process();
                landingScreenVisible = false;
            }).catch(() => {
                // decode() rejected — fall back to drawing immediately
                threshCanv.width = img.width;
                threshCanv.height = img.height;
                process();
                landingScreenVisible = false;
            });
        }

        if (img.complete && img.naturalWidth > 0) {
            onReady();
        } else {
            img.addEventListener("load", onReady);
        }

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

    let loadingCursor = false;

    // --- Resizable divider ---
    // Separate states for horizontal (desktop) and vertical (mobile) resize.

    const SIDEBAR_MIN = 180;
    const SIDEBAR_MAX = 600;
    const PANEL_MIN = 100; // min height for each panel in vertical/mobile mode

    let sidebarWidth = 250;    // desktop: sidebar width in px
    let splitHeight = 50;      // mobile: preview panel height as % of viewport

    let isDraggingH = false;   // dragging horizontal divider
    let isDraggingV = false;   // dragging vertical divider

    function onDividerMousedownH(e) {
        isDraggingH = true;
        e.preventDefault();
    }

    function onDividerMousedownV(e) {
        isDraggingV = true;
        e.preventDefault();
    }

    function onMousemove(e) {
        if (isDraggingH) {
            // Sidebar is on the right; compute width from right edge
            let newWidth = window.innerWidth - e.clientX;
            sidebarWidth = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, newWidth));
        }
        if (isDraggingV) {
            // Preview is on top; compute height as % of viewport
            let pct = (e.clientY / window.innerHeight) * 100;
            let minPct = (PANEL_MIN / window.innerHeight) * 100;
            let maxPct = 100 - minPct;
            splitHeight = Math.max(minPct, Math.min(maxPct, pct));
        }
        if (isPanning) {
            panX = e.clientX - panStartX;
            panY = e.clientY - panStartY;
        }
    }

    function onMouseup() {
        isDraggingH = false;
        isDraggingV = false;
        isPanning = false;
    }

    // --- Zoom / pan ---

    const ZOOM_MIN = 0.1;
    const ZOOM_MAX = 10;

    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;

    function resetView() {
        zoom = 1;
        panX = 0;
        panY = 0;
    }

    function onPreviewWheel(e) {
        e.preventDefault();
        let factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        let newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * factor));

        // Zoom toward the cursor position within the preview area
        let rect = e.currentTarget.getBoundingClientRect();
        let cx = e.clientX - rect.left - rect.width / 2;
        let cy = e.clientY - rect.top - rect.height / 2;
        panX = cx - (cx - panX) * (newZoom / zoom);
        panY = cy - (cy - panY) * (newZoom / zoom);
        zoom = newZoom;
    }

    function onPreviewMousedown(e) {
        // Only start panning on left-click, and not when clicking a divider
        if (e.button !== 0) return;
        if (e.target.id === "divider-h" || e.target.id === "divider-v") return;
        isPanning = true;
        panStartX = e.clientX - panX;
        panStartY = e.clientY - panY;
        e.preventDefault();
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

<svelte:window
    on:keydown={(e) => {
        // Keyboard shortcuts

        // Only suppress shortcuts when the user is actively typing in a text-like input
        const tag = e.target.tagName;
        const type = e.target.type;
        const isTyping = (tag === "TEXTAREA") ||
                            (tag === "INPUT" && type !== "range" && type !== "checkbox" && type !== "radio");
        if (isTyping) return;

        if (e.code === "Space") {
            e.preventDefault();
            globals.showPreview = !globals.showPreview;
            onInputChange();
        } else if (e.code === "KeyZ" && (e.ctrlKey || e.metaKey) && e.shiftKey) {
            e.preventDefault();
            redo();
        } else if (e.code === "KeyZ" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
            e.preventDefault();
            undo();
        }
    }}
    on:mousemove={onMousemove}
    on:mouseup={onMouseup}
/>

<div id="appshell"
    class:dragging-h={isDraggingH}
    class:dragging-v={isDraggingV}
    style:--split-height="{splitHeight}vh">
    <!-- Preview area -->
    <div id="previewSpace"
        role="region"
        aria-label="Image preview and drop zone"
        on:dragover|preventDefault={() => dragOver = true}
        on:dragleave={() => dragOver = false}
        on:drop={handleDrop}
        on:wheel|preventDefault={onPreviewWheel}
        on:mousedown={onPreviewMousedown}
        on:dblclick|self={resetView}
        class:drag-over={dragOver}
        class:panning={isPanning}>
        {#if dragOver}
            <div class="drop-overlay">Drop image here</div>
        {/if}

        <!-- Zoom/pan transform wrapper -->
        <div id="previewContent"
            style:transform="translate({panX}px, {panY}px) scale({zoom})"
            style:transform-origin="center center">
            {#if globals.baseIMG && !globals.showPreview}
                <img src={globals.baseIMG.src} alt="base layer" id="baseImage" draggable="false"
                    width={globals.baseIMG.width}
                    height={globals.baseIMG.height} />
            {/if}
            <canvas bind:this={threshCanv}
                style:display={(globals.showPreview && globals.previewMode === "Mask") ? "block" : "none"}
                style:width="{globals.baseIMG ? globals.baseIMG.width + 'px' : ''}"
                style:height="{globals.baseIMG ? globals.baseIMG.height + 'px' : ''}"></canvas>
            <canvas bind:this={glowCanv}
                style:display={(globals.showPreview && globals.previewMode === "Glow Only") ? "block" : "none"}
                style:width="{globals.baseIMG ? globals.baseIMG.width + 'px' : ''}"
                style:height="{globals.baseIMG ? globals.baseIMG.height + 'px' : ''}"></canvas>
            <canvas bind:this={compCanv}
                style:display={(globals.showPreview && globals.previewMode === "Full") ? "block" : "none"}
                style:width="{globals.baseIMG ? globals.baseIMG.width + 'px' : ''}"
                style:height="{globals.baseIMG ? globals.baseIMG.height + 'px' : ''}"></canvas>
        </div>

        <div id="zoomControls" on:mousedown|stopPropagation>
            <button class="zoom-btn" on:click|stopPropagation={() => {
                let newZoom = Math.min(ZOOM_MAX, zoom * 1.25);
                panX = panX * (newZoom / zoom);
                panY = panY * (newZoom / zoom);
                zoom = newZoom;
            }} title="Zoom in">
                <!-- Plus icon -->
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <circle cx="11" cy="11" r="7"/>
                    <line x1="11" y1="8" x2="11" y2="14"/>
                    <line x1="8" y1="11" x2="14" y2="11"/>
                    <line x1="16.5" y1="16.5" x2="21" y2="21"/>
                </svg>
            </button>
            <button class="zoom-btn" on:click|stopPropagation={() => {
                let newZoom = Math.max(ZOOM_MIN, zoom / 1.25);
                panX = panX * (newZoom / zoom);
                panY = panY * (newZoom / zoom);
                zoom = newZoom;
            }} title="Zoom out">
                <!-- Minus icon -->
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <circle cx="11" cy="11" r="7"/>
                    <line x1="8" y1="11" x2="14" y2="11"/>
                    <line x1="16.5" y1="16.5" x2="21" y2="21"/>
                </svg>
            </button>
            <div class="zoom-divider"></div>
            <button class="zoom-btn" class:muted={zoom === 1 && panX === 0 && panY === 0}
                on:click|stopPropagation={resetView} title="Reset view (double-click preview)">
                <!-- Fit/reset icon -->
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <polyline points="15 3 21 3 21 9"/>
                    <polyline points="9 21 3 21 3 15"/>
                    <line x1="21" y1="3" x2="14" y2="10"/>
                    <line x1="3" y1="21" x2="10" y2="14"/>
                </svg>
            </button>
        </div>
    </div>

    <!-- Vertical divider (mobile: between preview top and controls bottom) -->
    <div id="divider-v"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize preview and controls"
        tabindex="0"
        on:mousedown={onDividerMousedownV}></div>

    <!-- Horizontal divider (desktop: between preview left and sidebar right) -->
    <div id="divider-h"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        tabindex="0"
        on:mousedown={onDividerMousedownH}></div>

    <!-- Sidebar controls -->
    <Controls bind:globals sidebarWidth={sidebarWidth}
        on:change={onInputChange}
        on:commit={pushHistory}
        on:preset={(e) => applyPreset(e.detail)}>
        <div slot="export-buttons" id="exportpanel">
        {#if !isPhotopeaPlugin && !isPhotoshopPlugin}
            <button on:click={() => {
                let previewQualityTemp = globals.previewQuality;
                globals.previewQuality = 1;
                loadingCursor = true;
                requestAnimationFrame(() => process({
                    onComplete: () => {
                        canvDownload(false);
                        globals.previewQuality = previewQualityTemp;
                        loadingCursor = false;
                    }
                }));
            }}>Export Full Image</button>
            <button on:click={() => {
                let previewQualityTemp = globals.previewQuality;
                globals.previewQuality = 1;
                loadingCursor = true;
                requestAnimationFrame(() => process({
                    skipComposite: true,
                    onComplete: () => {
                        canvDownload(true);
                        globals.previewQuality = previewQualityTemp;
                        loadingCursor = false;
                    }
                }));
            }}>Export Bloom Layer</button>
        {:else if isPhotopeaPlugin}
            <button on:click={() => {
                let previewQualityTemp = globals.previewQuality;
                globals.previewQuality = 1;
                loadingCursor = true;
                requestAnimationFrame(() => process({
                    skipComposite: true,
                    onComplete: async () => {
                        await pea.openFromURL(glowCanv.toDataURL(), true);
                        await pea.runScript(`app.activeDocument.activeLayer.blendMode = "scrn";`);
                        await pea.runScript(`app.activeDocument.activeLayer.name = "SuperBloom";`);
                        globals.previewQuality = previewQualityTemp;
                        loadingCursor = false;
                    }
                }));
            }}>Add to Document</button>
        {:else if isPhotoshopPlugin}
            <button on:click={() => {
                let previewQualityTemp = globals.previewQuality;
                globals.previewQuality = 1;
                loadingCursor = true;
                requestAnimationFrame(() => process({
                    skipComposite: true,
                    onComplete: () => {
                        // Encode raw RGBA pixels as base64 — avoids PNG encoding/decoding
                        // and doesn't rely on UXP canvas support.
                        // Chunked String.fromCharCode prevents stack overflow on large images.
                        let imageData = glowCanv.getContext("2d").getImageData(0, 0, glowCanv.width, glowCanv.height);
                        let bytes = new Uint8Array(imageData.data.buffer);
                        let binary = "";
                        const CHUNK = 8192;
                        for (let i = 0; i < bytes.length; i += CHUNK) {
                            binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
                        }
                        window.uxpHost.postMessage({
                            type: "exportLayer",
                            data: btoa(binary),
                            metadata: getPresetData(globals),
                        });
                        globals.previewQuality = previewQualityTemp;
                        loadingCursor = false;
                    }
                }));
            }}>Finish</button>
        {/if}
    </div>
</Controls>
</div>

{#if landingScreenVisible}
    <LandingScreen
        isPhotoshopPlugin={isPhotoshopPlugin}
        isPlugin={isPhotopeaPlugin || isPhotoshopPlugin}
        on:upload={(e) => handleFileUpload(e.detail)}
        on:drop={(e) => handleFileUpload(e.detail)} />
{/if}

{#if loadingCursor}
    <div style:position="fixed"
        style:inset="0"
        style:cursor="wait"
        style:z-index="100"
        style:pointer-events="all"></div>
{/if}

<style>
    :global(:root) {
        --ux-font: "Open Sans", sans-serif;
        --special-color: #9800B0;
        --field-color: #0F0F0F;
        --bg-color: #1E1E1E;
        --divider-color: #333;
        --divider-hover: #555;
    }

    :global(body) {
        background-color: var(--bg-color);
        user-select: none;
        margin: 0;
        overflow: hidden;
    }

    /* App shell: side-by-side on desktop */
    #appshell {
        display: flex;
        flex-direction: row;
        width: 100vw;
        height: 100vh;
        position: fixed;
        top: 0;
        left: 0;
    }

    /* Suppress text selection while dragging */
    #appshell.dragging-h,
    #appshell.dragging-v {
        cursor: grabbing;
    }
    #appshell.dragging-h { cursor: col-resize; }
    #appshell.dragging-v { cursor: row-resize; }

    /* Preview takes all remaining space to the left of the sidebar */
    #previewSpace {
        flex: 1 1 0;
        min-width: 0;
        height: 100vh;
        text-align: center;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 25px;
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
        cursor: grab;
    }

    #previewSpace.panning {
        cursor: grabbing;
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

    /* Inner wrapper that receives the zoom/pan transform */
    #previewContent {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        will-change: transform;
    }

    canvas, img#baseImage {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        display: block;
    }

    #zoomControls {
        position: absolute;
        bottom: 14px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 2px;
        background: rgba(20, 20, 20, 0.85);
        backdrop-filter: blur(6px);
        border-radius: 8px;
        padding: 5px 7px;
        z-index: 5;
        opacity: 0;
        transition: opacity 0.2s;
        pointer-events: none;
    }

    #previewSpace:hover #zoomControls {
        opacity: 1;
        pointer-events: all;
    }

    .zoom-btn {
        background: transparent;
        border: 0;
        border-radius: 5px;
        padding: 5px;
        cursor: pointer;
        color: whitesmoke;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.15s;
        text-transform: none;
        letter-spacing: 0;
        font-size: inherit;
        font-weight: normal;
        margin: 0;
    }

    .zoom-btn svg {
        width: 16px;
        height: 16px;
    }

    .zoom-btn:hover {
        background-color: rgba(255, 255, 255, 0.12) !important;
    }

    .zoom-btn.muted {
        opacity: 0.35;
        pointer-events: none;
    }

    .zoom-divider {
        width: 1px;
        height: 16px;
        background: rgba(255, 255, 255, 0.2);
        margin: 0 3px;
    }

    /* Horizontal divider — between preview and sidebar on desktop */
    #divider-h {
        width: 5px;
        height: 100vh;
        background-color: var(--divider-color);
        cursor: col-resize;
        flex-shrink: 0;
        transition: background-color 0.15s;
        position: relative;
        z-index: 10;
    }
    #divider-h:hover,
    #appshell.dragging-h #divider-h {
        background-color: var(--special-color);
    }

    /* Vertical divider — hidden on desktop, shown on mobile */
    #divider-v {
        display: none;
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

    /* Mobile layout: stack vertically */
    @media only screen and (max-width: 500px) {
        #appshell {
            flex-direction: column;
        }

        /* Preview on top, fixed height driven by splitHeight state */
        #previewSpace {
            width: 100vw;
            height: var(--split-height, 50vh);
            flex: none;
        }

        /* Show vertical divider, hide horizontal */
        #divider-v {
            display: block;
            width: 100vw;
            height: 5px;
            background-color: var(--divider-color);
            cursor: row-resize;
            flex-shrink: 0;
            transition: background-color 0.15s;
        }
        #divider-v:hover,
        #appshell.dragging-v #divider-v {
            background-color: var(--special-color);
        }

        #divider-h {
            display: none;
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
