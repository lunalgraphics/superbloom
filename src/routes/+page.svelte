<script>
    import bannerImg from "$lib/assets/banner_plain.png";
    import coverartImg from "$lib/assets/coverart.jpg";
    import { onMount } from "svelte";
    import main from "$lib/scripts/main.js";
    import sliders from "$lib/scripts/sliders.js";
    import plugin from "$lib/scripts/plugin.js";

    onMount(() => {
        main();
        sliders();
        plugin();
    });
</script>


<div id="guicontainer"></div>
<div style="position: fixed; left: 0; top: 0; height: 100vh; width: calc(100vw - 250px); text-align: center;" id="previewSpace">
    <div class="centeredblock">
        <canvas></canvas>
        <canvas id="finalcanv"></canvas>
    </div>
</div>
<div id="waitCover"></div>
<div id="landingscreen">
    <div style="position: absolute; width: 500px; right: 0; top: 0; height: 100vh;" id="lsRight">
        <div class="centeredblock" style="text-align: center;">
            <input type="file" accept="image/*" id="imgupload" />
            
            <img src={bannerImg} alt="SuperBloom" width="512px" draggable="false" />
            <br />
            <button id="uploadButton">Upload Image</button>
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

    #imgupload {
        display: none;
    }

    #waitCover {
        display: none;
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
        #finalcanv {
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