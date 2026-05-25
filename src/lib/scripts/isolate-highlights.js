// ISOLATE HIGHLIGHTS
//
// Written by yikuans
//
// Isolates the brightest pixels of a canvas by applying a linear remap
// that maps the range [threshold, 255] → [0, 255].
//
// Pixels at or below the threshold become 0 (black), pixels at 255 stay 255.
// Values between are linearly interpolated. This effectively extracts the
// light sources from an image for use as a bloom/glow mask.

function isolateHighlights(ctx, threshold) {
    // Linear remap formula: output = 255 / (255 - threshold) * (value - 255) + 255
    //
    // When value == threshold → output = 0
    // When value == 255      → output = 255
    // When value < threshold → output is negative, clamped to 0 by Uint8ClampedArray
    var threshFunc = function(val, thresh) {
        return 255 / (255 - thresh) * (val - 255) + 255;
    };
    var imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    var data = imageData.data;
    for (var i = 0; i < data.length; i += 4) {
        for (var j = 0; j < 3; j++) {
            data[i + j] = threshFunc(data[i + j], threshold);
        }
    }
    ctx.putImageData(imageData, 0, 0);
}

export default isolateHighlights;