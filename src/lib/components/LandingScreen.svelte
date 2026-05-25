<script>
    import bannerImg from "$lib/assets/banner_plain.png";
    import coverartImg from "$lib/assets/coverart.jpg";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    /** Whether the Photoshop plugin mode is active (shows a loading spinner) */
    export let isPhotoshopPlugin = false;

    /** Whether any plugin mode is active (hides the upload button) */
    export let isPlugin = false;

    /** @type {HTMLInputElement} */
    let imgUpload;
</script>

<div id="landingscreen">
    <div id="lsRight">
        <div class="centeredblock" style="text-align: center;">
            <input type="file" accept="image/*"
                bind:this={imgUpload} style:display="none"
                on:change={() => {
                    let file = imgUpload.files[0];
                    if (!file) return;
                    dispatch("upload", file);
                }} />

            <div class="banner-container">
                {#each new Array(6).fill(0) as _, i}
                    <img src={bannerImg} alt="SuperBloom" width="100%" draggable="false"
                        style:position="absolute" style:top="0" style:left="0"
                        style:filter="blur({(i) ** 2 * 3}px)" style:mix-blend-mode="screen" />
                {/each}
            </div>
            <br />
            {#if !isPlugin}
                <button id="uploadButton" on:click={() => imgUpload.click()}>Upload Image</button>
            {:else if isPhotoshopPlugin}
                <div class="spinner"></div>
            {/if}
        </div>

        <div id="creditsbox">
            Copyright (c) 2025 Lunal Graphics<br />
            Developed by Yikuan Sun
        </div>
    </div>
    <div class="cover-art" style:background-image="url('{coverartImg}')"></div>
</div>

<style>
    #landingscreen {
        position: fixed;
        background-color: var(--bg-color);
        z-index: 69;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
    }

    #lsRight {
        position: absolute;
        width: 500px;
        right: 0;
        top: 0;
        height: 100vh;
    }

    .centeredblock {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
    }

    .banner-container {
        position: relative;
        width: calc(min(512px, 100vw));
        height: 100px;
    }

    .cover-art {
        position: absolute;
        width: calc(100vw - 500px);
        left: 0;
        top: 0;
        height: 100vh;
        background-size: cover;
        background-position: center;
    }

    .spinner {
        width: 42px;
        height: 42px;
        border-radius: 100%;
        border: 4px solid grey;
        border-top-color: deepskyblue;
        animation: spin 1s linear infinite;
        margin: 8px;
        display: inline-block;
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
            width: 100vw !important;
        }
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
</style>
