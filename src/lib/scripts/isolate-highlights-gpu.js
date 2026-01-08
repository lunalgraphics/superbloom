// GPU-accelerated version of isolate highlights
// Uses WebGL compute shaders for pixel processing

import WebGLRenderer from '../webgl-renderer.js';

class GPUHighlightProcessor {
    constructor() {
        this.renderer = null;
        this.canvas = null;
    }

    init() {
        // Create offscreen canvas for GPU processing
        this.canvas = document.createElement('canvas');
        this.renderer = new WebGLRenderer();
        this.renderer.init(this.canvas);
    }

    // GPU-accelerated version of isolateHighlights
    isolateHighlights(imageData, width, height, threshold) {
        if (!this.renderer) {
            this.init();
        }

        // Set canvas size
        this.canvas.width = width;
        this.canvas.height = height;

        // Create texture from image data
        const gl = this.renderer.gl;
        const inputTexture = this.renderer.createTexture(width, height, imageData);

        // Apply threshold using GPU shader
        const result = this.renderer.applyThreshold(inputTexture, width, height, threshold);

        // Read back the processed pixels
        gl.bindFramebuffer(gl.FRAMEBUFFER, result.framebuffer);
        const processedPixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, processedPixels);

        return processedPixels;
    }

    // Fallback to CPU version if WebGL is not available
    isolateHighlightsCPU(ctx, threshold) {
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

    cleanup() {
        if (this.renderer) {
            this.renderer.cleanup();
        }
    }
}

// Create singleton instance
const gpuProcessor = new GPUHighlightProcessor();

// Enhanced isolateHighlights function with GPU acceleration
function isolateHighlights(ctx, threshold) {
    try {
        // Try GPU acceleration first
        const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
        const processedPixels = gpuProcessor.isolateHighlights(
            imageData.data, 
            ctx.canvas.width, 
            ctx.canvas.height, 
            threshold
        );
        
        // Create new ImageData with processed pixels
        const clampedArray = new Uint8ClampedArray(processedPixels);
        const newImageData = new ImageData(clampedArray, ctx.canvas.width, ctx.canvas.height);
        ctx.putImageData(newImageData, 0, 0);
        
        console.log('GPU highlight isolation successful');
        
    } catch (error) {
        console.warn('GPU acceleration failed, falling back to CPU:', error.message);
        // Fallback to CPU version
        gpuProcessor.isolateHighlightsCPU(ctx, threshold);
    }
}

export default isolateHighlights;
export { GPUHighlightProcessor };