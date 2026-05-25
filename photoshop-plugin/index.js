/**
 * SuperBloom — Photoshop UXP Plugin Host Script
 *
 * This script runs in the UXP host context and handles:
 * 1. Sending the active document's pixel data to the SuperBloom webview
 * 2. Receiving the processed bloom layer back and inserting it as a Smart Object
 * 3. Re-opening existing SuperBloom layers for non-destructive editing
 *
 * Communication with the webview (SvelteKit app) happens via postMessage.
 */

const { app, core, imaging, constants, action } = require("photoshop");
const { entrypoints, storage } = require("uxp");
const fs = storage.localFileSystem;

/** @type {HTMLWebViewElement} */
let webView = document.getElementById("container");
let webViewLoaded = false;

/** @type {HTMLDialogElement} */
let modal = document.getElementById("dialog");

// --- Message handler: receives events from the SuperBloom webview ---
window.addEventListener("message", (e) => {
    if (typeof e.data == "string") e.data = JSON.parse(e.data);
    console.log(e);

    if (e.data.type == "webViewLoaded") {
        // The webview signals it's ready to receive image data
        webViewLoaded = true;
        console.log("webview loaded");
    }
    else if (e.data.type == "exportLayer") {
        // The webview sends back processed bloom pixels to be inserted as a layer
        console.log("exporting");
        let view = Uint8Array.from(e.data.data);
        modal.close();

        core.executeAsModal(async () => {
            // Create an ImageData object from the raw RGBA buffer
            let imageData = await imaging.createImageDataFromBuffer(view, {
                width: app.activeDocument.width,
                height: app.activeDocument.height,
                components: 4,
                colorSpace: "RGB",
            });

            // Insert the bloom as a new pixel layer
            let glowLayer = await app.activeDocument.layers.add();
            await imaging.putPixels({
                layerID: glowLayer.id,
                imageData: imageData,
            });
            glowLayer.bringToFront();
            glowLayer.name = "render";

            // Store the preset metadata in a hidden text layer (for later re-editing)
            let textLayer = await app.activeDocument.createTextLayer({
                contents: e.data.metadata,
                position: { x: 0, y: app.activeDocument.height / 2 },
                fontSize: 1,
            });
            textLayer.name = "metadata";
            textLayer.visible = false;
            textLayer.bringToFront();

            // Convert both layers into a single Smart Object
            app.activeDocument.activeLayers = [glowLayer, textLayer];
            action.batchPlay([
                {
                    _obj: "newPlacedLayer",
                    _isCommand: true,
                    _options: {
                        dialogOptions: "dontDisplay",
                    }
                }
            ], {});

            // Name and blend the Smart Object
            app.activeDocument.activeLayers[0].name = "SuperBloom";
            app.activeDocument.activeLayers[0].blendMode = constants.BlendMode.SCREEN;
        }).catch(err => core.showAlert(err));
    }
});

/**
 * Returns a promise that resolves once the webview signals it has loaded.
 */
async function waitForWebViewLoaded() {
    return new Promise((resolve) => {
        let interval = setInterval(() => {
            if (webViewLoaded) {
                clearInterval(interval);
                resolve();
            }
        }, 100);
    });
}

let modalVisible = false;

/**
 * Opens the SuperBloom modal dialog, captures the active document's pixels,
 * and sends them to the webview for processing.
 *
 * @param {string|undefined} preset - Optional JSON preset string to apply on load
 */
async function openModal(preset) {
    if (modalVisible) return;

    core.executeAsModal(async () => {
        if (app.documents.length == 0) {
            core.showAlert("Open a document to use SuperBloom.");
            return;
        }

        // Flatten a temporary copy to get a single merged pixel buffer
        let ogDoc = app.activeDocument;
        let tempDoc = await app.activeDocument.duplicate();
        await tempDoc.flatten();

        let { imageData } = await imaging.getPixels({
            documentID: tempDoc.id,
        });
        await tempDoc.closeWithoutSaving();
        app.activeDocument = ogDoc;

        // Show the modal with the embedded webview
        modal.uxpShowModal({
            title: "SuperBloom",
            resize: "both",
            size: {
                width: 1280,
                height: 720,
            },
        });
        modalVisible = true;
        webView.src = "plugin:/plugin-data/index.html?isPhotoshopPlugin=yeah";

        // Encode the pixel data as base64 JPEG and send to the webview
        let b64 = await imaging.encodeImageData({ imageData: imageData, base64: true });
        let imgUrl = "data:image/jpeg;base64," + b64;

        await waitForWebViewLoaded();
        webView.postMessage({
            type: "sourceImage",
            data: imgUrl,
        });

        // If re-editing, send the saved preset so the UI restores previous settings
        if (preset) {
            webView.postMessage({
                type: "preset",
                data: preset,
            });
        }
    }).catch(err => core.showAlert(err));
}

/**
 * Reads preset metadata from a selected SuperBloom Smart Object layer,
 * then re-opens the modal with those settings pre-applied.
 */
async function getLayerMetadata() {
    if (app.documents.length == 0) {
        core.showAlert("Open a document to use SuperBloom.");
        return;
    }

    let layer = app.activeDocument.activeLayers[0];
    if (layer.kind != constants.LayerKind.SMARTOBJECT) {
        core.showAlert("Selected layer is not a SuperBloom object.");
        return;
    }

    core.executeAsModal(async () => {
        // Open the Smart Object's contents to access the hidden metadata text layer
        await action.batchPlay([
            {
                _obj: "placedLayerEditContents",
                _options: {
                    dialogOptions: "dontDisplay",
                }
            }
        ], {});

        let textLayer = app.activeDocument.activeLayers[0];
        if (textLayer.kind != constants.LayerKind.TEXT) {
            await app.activeDocument.close(constants.SaveOptions.DONOTSAVECHANGES);
            await core.showAlert("Selected layer is not a SuperBloom object.");
            return;
        }

        // Extract the preset JSON from the text layer content
        let presetData = textLayer.textItem.contents;
        presetData = presetData.replaceAll("\u201C", '"'); // Replace smart quotes

        await app.activeDocument.close(constants.SaveOptions.DONOTSAVECHANGES);
        layer.visible = false;
        openModal(presetData);
    });
}

// --- UI button bindings ---
document.getElementById("launchBtn").addEventListener("click", openModal);
document.getElementById("editSelectedBtn").addEventListener("click", getLayerMetadata);

modal.addEventListener("close", () => {
    modalVisible = false;
    webViewLoaded = false;
});
