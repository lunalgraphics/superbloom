<script>
    import bannerImg from "$lib/assets/banner_plain.png";
    import coverartImg from "$lib/assets/coverart.jpg";
    import { onMount } from "svelte";
    import main from "$lib/scripts/main.js";
    import sliders from "$lib/scripts/sliders.js";
    import plugin from "$lib/scripts/plugin.js";
    import "$lib/styles/index.css";

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

<svelte:head>
    <title>SuperBloom</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap" rel="stylesheet" />
</svelte:head>