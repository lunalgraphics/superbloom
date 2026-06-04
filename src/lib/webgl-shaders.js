/**
 * GLSL shader sources for the WebGL bloom pipeline.
 * All passes share VERT_FULLSCREEN as vertex shader.
 * Fragment shaders are written in GLSL ES 1.00 (WebGL1/WebGL2 compatible).
 */

const VERT_FULLSCREEN = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
    // a_position is a full-screen quad in NDC [-1,1]
    // UV is [0,1] mapped from NDC
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAG_THRESHOLD = `
precision mediump float;
uniform sampler2D u_source;
uniform float u_threshold; // normalized [0,1]
varying vec2 v_uv;

void main() {
    vec4 color = texture2D(u_source, v_uv);
    float t = u_threshold;
    // Linear remap: maps [t,1] → [0,1], clamps below t to 0
    vec3 remapped = clamp((color.rgb - t) / (1.0 - t + 0.0001), 0.0, 1.0);
    gl_FragColor = vec4(remapped, color.a);
}
`;

const FRAG_DOWNSAMPLE = `
precision mediump float;
uniform sampler2D u_source;
uniform vec2 u_texelSize; // 1.0 / vec2(width, height)
uniform float u_offset;   // iteration + 0.5
varying vec2 v_uv;

void main() {
    vec2 o = u_texelSize * u_offset;
    vec4 sum = texture2D(u_source, v_uv) * 4.0;
    sum += texture2D(u_source, v_uv + vec2(-o.x,  o.y));
    sum += texture2D(u_source, v_uv + vec2( o.x,  o.y));
    sum += texture2D(u_source, v_uv + vec2(-o.x, -o.y));
    sum += texture2D(u_source, v_uv + vec2( o.x, -o.y));
    gl_FragColor = sum / 8.0;
}
`;

const FRAG_UPSAMPLE = `
precision mediump float;
uniform sampler2D u_source;
uniform vec2 u_texelSize;
uniform float u_offset;
varying vec2 v_uv;

void main() {
    vec2 o = u_texelSize * u_offset;
    vec4 sum  = texture2D(u_source, v_uv + vec2(-o.x,  0.0)) * 2.0;
    sum      += texture2D(u_source, v_uv + vec2( o.x,  0.0)) * 2.0;
    sum      += texture2D(u_source, v_uv + vec2( 0.0,  o.y)) * 2.0;
    sum      += texture2D(u_source, v_uv + vec2( 0.0, -o.y)) * 2.0;
    sum      += texture2D(u_source, v_uv + vec2(-o.x,  o.y));
    sum      += texture2D(u_source, v_uv + vec2( o.x,  o.y));
    sum      += texture2D(u_source, v_uv + vec2(-o.x, -o.y));
    sum      += texture2D(u_source, v_uv + vec2( o.x, -o.y));
    gl_FragColor = sum / 12.0;
}
`;

const FRAG_COLORIZE = `
precision mediump float;
uniform sampler2D u_source;
uniform float u_hue;          // degrees [-180, 180]
uniform float u_saturation;   // [0, 200], 100 = unchanged
uniform float u_brightness;   // [0, 200], 100 = unchanged
uniform bool  u_colorize;
uniform vec3  u_tintcolor;    // linear RGB [0,1]
uniform float u_tintopacity;  // [0, 1]
varying vec2 v_uv;

// RGB <-> HSL helpers
vec3 rgb2hsl(vec3 c) {
    float maxC = max(c.r, max(c.g, c.b));
    float minC = min(c.r, min(c.g, c.b));
    float l = (maxC + minC) * 0.5;
    if (maxC == minC) return vec3(0.0, 0.0, l);
    float d = maxC - minC;
    float s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
    float h;
    if (maxC == c.r)      h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
    else                  h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
    return vec3(h, s, l);
}

float hue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
    if (t < 0.5)     return q;
    if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
    return p;
}

vec3 hsl2rgb(vec3 hsl) {
    if (hsl.y == 0.0) return vec3(hsl.z);
    float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
    float p = 2.0 * hsl.z - q;
    return vec3(
        hue2rgb(p, q, hsl.x + 1.0/3.0),
        hue2rgb(p, q, hsl.x),
        hue2rgb(p, q, hsl.x - 1.0/3.0)
    );
}

// Luminance for color-blend mode
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// Set luminance of c to match target luma (used for color blend mode)
vec3 setLuma(vec3 c, float lum) {
    float d = lum - luma(c);
    return clamp(c + d, 0.0, 1.0);
}

void main() {
    vec4 src = texture2D(u_source, v_uv);
    vec3 rgb = src.rgb;

    // 1. Hue rotation
    if (u_hue != 0.0) {
        vec3 hsl = rgb2hsl(rgb);
        hsl.x = fract(hsl.x + u_hue / 360.0);
        rgb = hsl2rgb(hsl);
    }

    // 2. Selective saturation
    // effective_saturation = 100 / (existing_saturation_pct + 1)
    // Then scale toward gray by (effective_saturation * u_saturation / 100)
    {
        vec3 hsl = rgb2hsl(rgb);
        float existing_sat_pct = hsl.y * 100.0;
        float effective_sat = 100.0 / (existing_sat_pct + 1.0);
        float sat_scale = (u_saturation / 100.0) * (effective_sat / 100.0);
        // Blend between gray (luma) and current color
        float gray = hsl.z;
        rgb = mix(vec3(gray), rgb, 1.0 + (sat_scale - 1.0));
        rgb = clamp(rgb, 0.0, 1.0);
    }

    // 3. Brightness
    rgb *= (u_brightness / 100.0);
    rgb = clamp(rgb, 0.0, 1.0);

    // 4. Tint (color blend mode: preserve luminance, replace hue+chroma)
    if (u_colorize && u_tintopacity > 0.0) {
        // Color blend: output has hue+chroma of tint, luminance of source
        vec3 tinted = setLuma(u_tintcolor, luma(rgb));
        rgb = mix(rgb, tinted, u_tintopacity);
    }

    gl_FragColor = vec4(rgb, src.a);
}
`;

const FRAG_COMPOSITE = `
precision mediump float;
uniform sampler2D u_base;
uniform sampler2D u_glow;
varying vec2 v_uv;

void main() {
    vec4 base = texture2D(u_base, v_uv);
    vec4 glow = texture2D(u_glow, v_uv);
    // Screen blend: result = 1 - (1 - a)(1 - b)
    vec3 screened = 1.0 - (1.0 - base.rgb) * (1.0 - glow.rgb);
    gl_FragColor = vec4(screened, base.a);
}
`;

const FRAG_PASSTHROUGH = `
precision mediump float;
uniform sampler2D u_source;
varying vec2 v_uv;

void main() {
    gl_FragColor = texture2D(u_source, v_uv);
}
`;

export const SHADERS = {
    VERT_FULLSCREEN,
    FRAG_THRESHOLD,
    FRAG_DOWNSAMPLE,
    FRAG_UPSAMPLE,
    FRAG_COLORIZE,
    FRAG_COMPOSITE,
    FRAG_PASSTHROUGH,
};
