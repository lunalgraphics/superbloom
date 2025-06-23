import isolateHighlights from "$lib/scripts/isolate-highlights.js";
import ygui from "$lib/scripts/ygui.js";

export default function main() {
    var globals = {
        baseIMG: new Image(),
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

    function loadImage(imageURI, onLoad) {
        var img = new Image();
        img.onload = onLoad;
        img.src = imageURI;
    }

    function mainProcess(inputData=globals, callback=function() {}, layerOnly=false) {
        document.querySelector("#waitCover").style.display = "block";
        if (typeof inputData == "string") {
            inputData = JSON.parse(inputData);
        }
        
        var canv = document.querySelector("canvas");
        canv.style.display = "none";
        var ctx = canv.getContext("2d");
        ctx.restore();
        ctx.drawImage(inputData.baseIMG, 0, 0);
        ctx.save();

        if (inputData.threshold < 255) {
            isolateHighlights(ctx, inputData.threshold);
        }
        else {
            ctx.fillRect(0, 0, canv.width, canv.height);
        }

        if (inputData.colorize) {
            ctx.restore();
            ctx.save();
            ctx.globalAlpha = inputData.tintopacity / 100;
            ctx.fillStyle = inputData.tintcolor;
            ctx.globalCompositeOperation = "color";
            ctx.fillRect(0, 0, canv.width, canv.height);
            ctx.globalCompositeOperation = "multiply";
            ctx.fillRect(0, 0, canv.width, canv.height);
        }
        
        var canv2 = document.querySelectorAll("canvas")[1];
        canv2.width = canv.width;
        canv2.height = canv.height;
        var ctx2 = canv2.getContext("2d");

        for (var i = 1; i < inputData.glowLayers; i++) {
            var blurRadius = (i + 1) ** 2 * inputData.glowRadius;
            ctx2.restore();
            ctx2.save();
            ctx2.filter = `brightness(${inputData.brightness}%) hue-rotate(${inputData.hue}deg) saturate(${inputData.saturation}%) blur(${blurRadius}px)`;
            ctx2.globalCompositeOperation = "screen";
            ctx2.drawImage(canv, 0, 0);
        }

        if (layerOnly) {
            callback();
            document.querySelector("#waitCover").style.display = "none";
            return;
        }

        ctx2.restore();
        ctx2.save();
        ctx2.globalCompositeOperation = "screen";
        ctx2.drawImage(inputData.baseIMG, 0, 0);

        callback();
        document.querySelector("#waitCover").style.display = "none";
        
    }

    ygui.buildGUIsection([
        {
            "label": "Threshold",
            "type": "number",
            "id": "threshold",
            "attr": { "value": 222, "min": 0, "max": 254 }
        },
        {
            "label": "Depth",
            "type": "number",
            "id": "glowLayers",
            "attr": { "value": 16, "min": 1, "max": 30 }
        },
        {
            "label": "Radius",
            "type": "number",
            "id": "glowRadius",
            "attr": { "value": 1, "step": 0.1, "min": 0, "max": 6 }
        },
        {
            "label": "Colorize?",
            "type": "checkbox",
            "id": "colorize",
            "attr": {}
        },
        {
            "label": " - Color",
            "type": "color",
            "id": "tintcolor",
            "attr": { "value": "#FF5500", "disabled": "true" }
        },
        {
            "label": " - Opacity",
            "type": "number",
            "id": "tintopacity",
            "attr": { "value": 100, "min": 0, "max": 100, "disabled": "true" }
        },
        {
            "label": "Brightness",
            "type": "number",
            "id": "brightness",
            "attr": { "value": 100, "min": 0, "max": 200 }
        },
        {
            "label": "Saturation",
            "type": "number",
            "id": "saturation",
            "attr": { "value": 100, "min": 0, "max": 100 }
        },
        {
            "label": "Hue Shift",
            "type": "number",
            "id": "hue",
            "attr": { "value": 0, "min": -180, "max": 180 }
        },
        {
            "label": "Preview",
            "type": "select",
            "id": "showPreview",
            "attr": { "type": "select" },
            "options": ["Full", "None", "Glow Only"]
        }
    ], document.querySelector("#guicontainer"));
    for (var x of ["threshold", "glowLayers", "glowRadius", "colorize", "tintcolor", "showPreview", "saturation", "hue", "tintopacity", "brightness"]) {
        var inputElem = document.querySelector("#" + x);
        inputElem.addEventListener("input", function(e) {
            var y = this.id;
            switch (this.getAttribute("type")) {
                case "number":
                    globals[y] = parseFloat(this.value);
                    break;
                case "checkbox":
                    globals[y] = this.checked;
                    break;
                case "select":
                    globals[y] = this.value;
                    break;
                default:
                    globals[y] = this.value;
                    break;
            }
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
        });
    }
    document.querySelector("#imgupload").addEventListener("change", function() {
        var file = this.files[0];
        var fR = new FileReader();
        fR.addEventListener("loadend", function(e) {
            var imageuri = e.target.result;
            
            var image = new Image();
            image.src = imageuri;
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
    });
    document.querySelector("#uploadButton").addEventListener("click", function() {
        document.querySelector("#imgupload").click();
    });

    function canvDownload() {
        var a = document.createElement("a");
        a.href = document.querySelectorAll("canvas")[1].toDataURL();
        a.download = globals.imgname + "-superbloomed.png";
        a.click();
        
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
    var exportpanel = document.createElement("div");
    exportpanel.id = "exportpanel";
    document.querySelector("#guicontainer").appendChild(exportpanel);
    var fullexportbtn = document.createElement("button");
    fullexportbtn.innerText = "Export Full Image";
    exportpanel.appendChild(fullexportbtn);
    fullexportbtn.addEventListener("click", function() {
        mainProcess(globals, canvDownload, false);
    });
    var br = document.createElement("br");
    exportpanel.appendChild(br);
    var layerexportbtn = document.createElement("button");
    layerexportbtn.innerText = "Export Bloom Layer";
    exportpanel.appendChild(layerexportbtn);
    layerexportbtn.addEventListener("click", function() {
        mainProcess(globals, canvDownload, true);
    });

    document.querySelector("#colorize").addEventListener("change", function(e) {
        if (this.checked) {
            document.querySelector("#tintcolor").removeAttribute("disabled");
            document.querySelector("label[for=tintcolor]").style.opacity = "";
            document.querySelector("#tintcolor").style.opacity = "";
            document.querySelector("#tintopacity").removeAttribute("disabled");
            document.querySelector("label[for=tintopacity]").style.opacity = "";
            document.querySelector("#tintopacity").style.opacity = "";
            document.querySelector("input[data--i-d=tintopacity]").style.opacity = "";
            document.querySelector("input[data--i-d=tintopacity]").removeAttribute("disabled");
        }
        else {
            document.querySelector("#tintcolor").setAttribute("disabled", "true");
            document.querySelector("label[for=tintcolor]").style.opacity = "0.5";
            document.querySelector("#tintcolor").style.opacity = "0.5";
            document.querySelector("#tintopacity").setAttribute("disabled", "true");
            document.querySelector("label[for=tintopacity]").style.opacity = "0.5";
            document.querySelector("#tintopacity").style.opacity = "0.5";
            document.querySelector("input[data--i-d=tintopacity]").setAttribute("disabled", "true");
            document.querySelector("input[data--i-d=tintopacity]").style.opacity = "0.5";
        }
    });
    document.querySelector("label[for=tintcolor]").style.opacity = "0.5";
    document.querySelector("#tintcolor").style.opacity = "0.5";
    document.querySelector("label[for=tintopacity]").style.opacity = "0.5";
    document.querySelector("#tintopacity").style.opacity = "0.5";       
}