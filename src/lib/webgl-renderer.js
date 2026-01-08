// WebGL-based GPU accelerated renderer for SuperBloom
// Replaces Canvas 2D operations with GPU shaders

class WebGLRenderer {
    constructor() {
        this.gl = null;
        this.programs = {};
        this.framebuffers = {};
        this.textures = {};
        this.initialized = false;
    }

    // Initialize WebGL context and compile shaders
    init(canvas) {
        this.gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!this.gl) {
            throw new Error('WebGL not supported');
        }

        const gl = this.gl;

        // Try to enable float texture extensions (optional for basic operations)
        const floatExt = gl.getExtension('OES_texture_float');
        const floatLinearExt = gl.getExtension('OES_texture_float_linear');
        
        if (!floatExt) {
            console.warn('OES_texture_float not supported, using standard precision');
        } else {
            console.log('Float textures supported');
        }

        // Set up WebGL state
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.BLEND);

        try {
            this.compileShaders();
            this.createBuffers();
            this.initialized = true;
            
            console.log('WebGL renderer initialized successfully');
        } catch (error) {
            console.error('WebGL initialization failed:', error.message);
            throw error;
        }
    }

    // Vertex shader for full-screen quad
    getVertexShader() {
        return `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;
    }

    // Fragment shader for threshold isolation
    getThresholdFragmentShader() {
        return `
            precision mediump float;
            uniform sampler2D u_image;
            uniform float u_threshold;
            varying vec2 v_texCoord;
            
            void main() {
                vec4 color = texture2D(u_image, v_texCoord);
                
                // Threshold function: isolate highlights
                float thresh = u_threshold / 255.0;
                vec3 result = vec3(0.0);
                
                // Process RGB channels
                if (color.r > thresh) {
                    result.r = (255.0 / (255.0 - u_threshold)) * (color.r * 255.0 - 255.0) + 255.0;
                    result.r = result.r / 255.0;
                }
                if (color.g > thresh) {
                    result.g = (255.0 / (255.0 - u_threshold)) * (color.g * 255.0 - 255.0) + 255.0;
                    result.g = result.g / 255.0;
                }
                if (color.b > thresh) {
                    result.b = (255.0 / (255.0 - u_threshold)) * (color.b * 255.0 - 255.0) + 255.0;
                    result.b = result.b / 255.0;
                }
                
                gl_FragColor = vec4(result, color.a);
            }
        `;
    }

    // Fragment shader for Gaussian blur
    getBlurFragmentShader() {
        return `
            precision mediump float;
            uniform sampler2D u_image;
            uniform vec2 u_resolution;
            uniform vec2 u_direction;
            uniform float u_radius;
            varying vec2 v_texCoord;
            
            void main() {
                vec2 texelSize = 1.0 / u_resolution;
                vec4 color = vec4(0.0);
                float total = 0.0;
                
                // Simple 9-tap blur for compatibility
                float samples[9];
                samples[0] = -4.0; samples[1] = -3.0; samples[2] = -2.0;
                samples[3] = -1.0; samples[4] = 0.0;  samples[5] = 1.0;
                samples[6] = 2.0;  samples[7] = 3.0;  samples[8] = 4.0;
                
                float effectiveRadius = min(u_radius, 4.0);
                
                for (int i = 0; i < 9; i++) {
                    float offset = samples[i];
                    if (abs(offset) > effectiveRadius) continue;
                    
                    vec2 samplePos = v_texCoord + offset * u_direction * texelSize;
                    float weight = exp(-0.5 * (offset * offset) / (effectiveRadius * effectiveRadius * 0.16));
                    color += texture2D(u_image, samplePos) * weight;
                    total += weight;
                }
                
                gl_FragColor = color / total;
            }
        `;
    }

    // Fragment shader for color adjustments
    getColorAdjustFragmentShader() {
        return `
            precision mediump float;
            uniform sampler2D u_image;
            uniform float u_brightness;
            uniform float u_hue;
            uniform float u_saturation;
            varying vec2 v_texCoord;
            
            vec3 rgb2hsv(vec3 c) {
                vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
                vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
                vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
                float d = q.x - min(q.w, q.y);
                float e = 1.0e-10;
                return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
            }
            
            vec3 hsv2rgb(vec3 c) {
                vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }
            
            void main() {
                vec4 color = texture2D(u_image, v_texCoord);
                
                // Apply brightness
                color.rgb *= u_brightness;
                
                // Apply hue and saturation
                vec3 hsv = rgb2hsv(color.rgb);
                hsv.x += u_hue / 360.0;
                hsv.y *= u_saturation;
                color.rgb = hsv2rgb(hsv);
                
                gl_FragColor = color;
            }
        `;
    }

    // Fragment shader for colorize effect
    getColorizeFragmentShader() {
        return `
            precision mediump float;
            uniform sampler2D u_image;
            uniform vec3 u_tintColor;
            uniform float u_tintOpacity;
            uniform bool u_colorize;
            varying vec2 v_texCoord;
            
            void main() {
                vec4 color = texture2D(u_image, v_texCoord);
                
                if (u_colorize) {
                    // Apply color and multiply blend modes
                    vec3 tinted = mix(color.rgb, u_tintColor, u_tintOpacity);
                    color.rgb = color.rgb * tinted;
                }
                
                gl_FragColor = color;
            }
        `;
    }

    // Fragment shader for screen blend composition
    getCompositeFragmentShader() {
        return `
            precision mediump float;
            uniform sampler2D u_base;
            uniform sampler2D u_glow;
            varying vec2 v_texCoord;
            
            void main() {
                vec4 base = texture2D(u_base, v_texCoord);
                vec4 glow = texture2D(u_glow, v_texCoord);
                
                // Screen blend mode: 1 - (1 - base) * (1 - glow)
                vec3 result = vec3(1.0) - (vec3(1.0) - base.rgb) * (vec3(1.0) - glow.rgb);
                
                gl_FragColor = vec4(result, base.a);
            }
        `;
    }

    // Compile and link shader program
    createProgram(vertexSource, fragmentSource) {
        const gl = this.gl;
        
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
        
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('Program link error: ' + gl.getProgramInfoLog(program));
        }
        
        return program;
    }

    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Shader compile error: ${error}`);
        }
        
        return shader;
    }

    compileShaders() {
        try {
            const vertexShader = this.getVertexShader();
            
            this.programs.threshold = this.createProgram(vertexShader, this.getThresholdFragmentShader());
            this.programs.blur = this.createProgram(vertexShader, this.getBlurFragmentShader());
            this.programs.colorAdjust = this.createProgram(vertexShader, this.getColorAdjustFragmentShader());
            this.programs.colorize = this.createProgram(vertexShader, this.getColorizeFragmentShader());
            this.programs.composite = this.createProgram(vertexShader, this.getCompositeFragmentShader());
            
            console.log('All shaders compiled successfully');
        } catch (error) {
            console.error('Shader compilation failed:', error.message);
            throw error;
        }
    }

    createBuffers() {
        const gl = this.gl;
        
        // Full-screen quad vertices (position + texCoord)
        const vertices = new Float32Array([
            -1, -1, 0, 0,  // bottom-left
             1, -1, 1, 0,  // bottom-right
            -1,  1, 0, 1,  // top-left
             1,  1, 1, 1   // top-right
        ]);
        
        this.vertexBuffer = gl.createBuffer();
        if (!this.vertexBuffer) {
            throw new Error('Failed to create vertex buffer');
        }
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        
        // Verify buffer was created successfully
        const bufferSize = gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE);
        if (bufferSize !== vertices.byteLength) {
            throw new Error('Vertex buffer creation failed');
        }
    }

    createTexture(width, height, data = null) {
        const gl = this.gl;
        const texture = gl.createTexture();
        
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        return texture;
    }

    createFramebuffer(width, height) {
        const gl = this.gl;
        const framebuffer = gl.createFramebuffer();
        const texture = this.createTexture(width, height);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        
        return { framebuffer, texture };
    }

    setupVertexAttributes(program) {
        const gl = this.gl;
        
        // Bind the vertex buffer first
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        
        const positionLocation = gl.getAttribLocation(program, 'a_position');
        const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
        
        if (positionLocation >= 0) {
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
        }
        
        if (texCoordLocation >= 0) {
            gl.enableVertexAttribArray(texCoordLocation);
            gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 16, 8);
        }
    }

    // Main processing function - GPU accelerated version of mainProcess
    process(inputData, callback = () => {}) {
        if (!this.initialized) {
            throw new Error('WebGL renderer not initialized');
        }

        console.log('Starting GPU processing...');
        const gl = this.gl;
        const width = Math.floor(inputData.baseIMG.width * inputData.previewQuality);
        const height = Math.floor(inputData.baseIMG.height * inputData.previewQuality);

        // Set viewport
        gl.viewport(0, 0, width, height);

        try {
            // Create input texture from image
            console.log('Creating input texture...');
            const inputTexture = this.createTextureFromImage(inputData.baseIMG, width, height);

            // Step 1: Threshold isolation
            console.log('Applying threshold...');
            const thresholdResult = this.applyThreshold(inputTexture, width, height, inputData.threshold);

            // Step 1.5: Apply colorize if enabled
            let processedTexture = thresholdResult.texture;
            if (inputData.colorize) {
                console.log('Applying colorize...');
                const colorizeResult = this.applyColorize(processedTexture, width, height, inputData);
                processedTexture = colorizeResult.texture;
            }

            // Step 2: Generate glow layers
            console.log('Generating glow layers...');
            const glowResult = this.generateGlow(processedTexture, width, height, inputData);

            // Step 3: Final composition
            console.log('Compositing final image...');
            const finalResult = this.compositeImages(inputTexture, glowResult.texture, width, height);

            // Copy results back to canvases for compatibility
            console.log('Copying results to canvases...');
            this.copyToCanvas(thresholdResult.texture, width, height, 'threshold');
            this.copyToCanvas(glowResult.texture, width, height, 'glow');
            this.copyToCanvas(finalResult.texture, width, height, 'composite');

            console.log('GPU processing pipeline completed successfully');
            callback();
        } catch (error) {
            console.error('GPU processing pipeline failed:', error.message);
            throw error;
        }
    }

    createTextureFromImage(image, width, height) {
        const gl = this.gl;
        
        // Create temporary canvas to resize image
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(image, 0, 0, width, height);
        
        const imageData = tempCtx.getImageData(0, 0, width, height);
        return this.createTexture(width, height, imageData.data);
    }

    applyThreshold(inputTexture, width, height, threshold) {
        const gl = this.gl;
        const program = this.programs.threshold;
        const fb = this.createFramebuffer(width, height);

        gl.bindFramebuffer(gl.FRAMEBUFFER, fb.framebuffer);
        gl.useProgram(program);

        this.setupVertexAttributes(program);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);
        gl.uniform1f(gl.getUniformLocation(program, 'u_threshold'), threshold);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        return fb;
    }

    applyColorize(inputTexture, width, height, inputData) {
        const gl = this.gl;
        const program = this.programs.colorize;
        const fb = this.createFramebuffer(width, height);

        gl.bindFramebuffer(gl.FRAMEBUFFER, fb.framebuffer);
        gl.useProgram(program);

        this.setupVertexAttributes(program);

        // Parse hex color to RGB
        const hex = inputData.tintcolor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16) / 255;
        const g = parseInt(hex.substr(2, 2), 16) / 255;
        const b = parseInt(hex.substr(4, 2), 16) / 255;

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);
        gl.uniform3f(gl.getUniformLocation(program, 'u_tintColor'), r, g, b);
        gl.uniform1f(gl.getUniformLocation(program, 'u_tintOpacity'), inputData.tintopacity / 100);
        gl.uniform1i(gl.getUniformLocation(program, 'u_colorize'), inputData.colorize ? 1 : 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        return fb;
    }

    applyColorAdjustments(inputTexture, width, height, inputData) {
        const gl = this.gl;
        const program = this.programs.colorAdjust;
        const fb = this.createFramebuffer(width, height);

        gl.bindFramebuffer(gl.FRAMEBUFFER, fb.framebuffer);
        gl.useProgram(program);

        this.setupVertexAttributes(program);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);
        gl.uniform1f(gl.getUniformLocation(program, 'u_brightness'), inputData.brightness / 100);
        gl.uniform1f(gl.getUniformLocation(program, 'u_hue'), inputData.hue);
        gl.uniform1f(gl.getUniformLocation(program, 'u_saturation'), inputData.saturation / 100);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        return fb;
    }

    generateGlow(thresholdTexture, width, height, inputData) {
        const gl = this.gl;
        let currentTexture = thresholdTexture;

        // Apply color adjustments first
        const colorAdjusted = this.applyColorAdjustments(currentTexture, width, height, inputData);
        currentTexture = colorAdjusted.texture;

        // Create accumulation texture for glow layers
        let accumulatedGlow = null;

        // Apply multiple blur passes for glow layers
        for (let i = 1; i < inputData.glowLayers; i++) {
            // Match CPU behavior: scale blur radius with preview quality for consistent visual effect
            const baseBlurRadius = Math.pow(i + 1, 2) * inputData.glowRadius * inputData.previewQuality;
            
            // Apply asymmetric blur for anamorph effect
            const horizontalBlurRadius = baseBlurRadius * (1 + inputData.anamorph);
            const verticalBlurRadius = baseBlurRadius;
            
            // Apply asymmetric blur
            const blurred = this.applyAsymmetricBlur(currentTexture, width, height, horizontalBlurRadius, verticalBlurRadius);
            
            // Blend with screen mode (accumulate glow)
            if (accumulatedGlow === null) {
                accumulatedGlow = blurred.texture;
            } else {
                const blended = this.blendScreen(accumulatedGlow, blurred.texture, width, height);
                accumulatedGlow = blended.texture;
            }
        }

        return { texture: accumulatedGlow || currentTexture };
    }

    applyBlur(inputTexture, width, height, radius) {
        // Use asymmetric blur with same radius for both directions
        return this.applyAsymmetricBlur(inputTexture, width, height, radius, radius);
    }

    applyAsymmetricBlur(inputTexture, width, height, horizontalRadius, verticalRadius) {
        const gl = this.gl;
        const program = this.programs.blur;

        // Two-pass blur with different radii for horizontal and vertical
        const horizontalFb = this.createFramebuffer(width, height);
        const verticalFb = this.createFramebuffer(width, height);

        // Horizontal pass
        gl.bindFramebuffer(gl.FRAMEBUFFER, horizontalFb.framebuffer);
        gl.useProgram(program);
        this.setupVertexAttributes(program);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);
        gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), width, height);
        gl.uniform2f(gl.getUniformLocation(program, 'u_direction'), 1, 0);
        gl.uniform1f(gl.getUniformLocation(program, 'u_radius'), horizontalRadius);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Vertical pass
        gl.bindFramebuffer(gl.FRAMEBUFFER, verticalFb.framebuffer);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, horizontalFb.texture);
        gl.uniform2f(gl.getUniformLocation(program, 'u_direction'), 0, 1);
        gl.uniform1f(gl.getUniformLocation(program, 'u_radius'), verticalRadius);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        return verticalFb;
    }



    blendScreen(texture1, texture2, width, height) {
        const gl = this.gl;
        const program = this.programs.composite;
        const fb = this.createFramebuffer(width, height);

        gl.bindFramebuffer(gl.FRAMEBUFFER, fb.framebuffer);
        gl.useProgram(program);

        this.setupVertexAttributes(program);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture1);
        gl.uniform1i(gl.getUniformLocation(program, 'u_base'), 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, texture2);
        gl.uniform1i(gl.getUniformLocation(program, 'u_glow'), 1);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        return fb;
    }

    compositeImages(baseTexture, glowTexture, width, height) {
        return this.blendScreen(baseTexture, glowTexture, width, height);
    }

    copyToCanvas(texture, width, height, canvasType) {
        const gl = this.gl;
        
        // Create temporary framebuffer to read pixels
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        // Store for external access
        this.lastResults = this.lastResults || {};
        this.lastResults[canvasType] = {
            data: pixels,
            width: width,
            height: height
        };
    }

    getImageData(canvasType) {
        return this.lastResults?.[canvasType] || null;
    }

    cleanup() {
        if (this.gl) {
            // Clean up WebGL resources
            Object.values(this.programs).forEach(program => this.gl.deleteProgram(program));
            Object.values(this.framebuffers).forEach(fb => {
                this.gl.deleteFramebuffer(fb.framebuffer);
                this.gl.deleteTexture(fb.texture);
            });
            Object.values(this.textures).forEach(texture => this.gl.deleteTexture(texture));
        }
    }
}

export default WebGLRenderer;