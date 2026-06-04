import { describe, it, expect, vi } from 'vitest';
import { detectWebGL, createFBO, resizeFBO } from '../webgl-resources.js';

/**
 * Unit tests for detectWebGL.
 * Since we're in a Node environment (no real canvas/WebGL), we use
 * mock canvas objects to validate the detection logic.
 */
describe('detectWebGL', () => {
    it('returns "webgl2" when WebGL2 context is available', () => {
        const canvas = {
            getContext: vi.fn((type) => {
                if (type === 'webgl2') return {}; // truthy context
                return null;
            }),
        };

        expect(detectWebGL(canvas)).toBe('webgl2');
        expect(canvas.getContext).toHaveBeenCalledWith('webgl2');
    });

    it('returns "webgl" when WebGL2 is unavailable but WebGL1 is', () => {
        const canvas = {
            getContext: vi.fn((type) => {
                if (type === 'webgl2') return null;
                if (type === 'webgl') return {}; // truthy context
                return null;
            }),
        };

        expect(detectWebGL(canvas)).toBe('webgl');
        expect(canvas.getContext).toHaveBeenCalledWith('webgl2');
        expect(canvas.getContext).toHaveBeenCalledWith('webgl');
    });

    it('returns null when neither WebGL2 nor WebGL1 is available', () => {
        const canvas = {
            getContext: vi.fn(() => null),
        };

        expect(detectWebGL(canvas)).toBe(null);
        expect(canvas.getContext).toHaveBeenCalledWith('webgl2');
        expect(canvas.getContext).toHaveBeenCalledWith('webgl');
    });

    it('returns null when canvas is null', () => {
        expect(detectWebGL(null)).toBe(null);
    });

    it('returns null when canvas is undefined', () => {
        expect(detectWebGL(undefined)).toBe(null);
    });

    it('returns null when canvas has no getContext method', () => {
        expect(detectWebGL({})).toBe(null);
    });

    it('tries WebGL2 before WebGL1 (priority order)', () => {
        const callOrder = [];
        const canvas = {
            getContext: vi.fn((type) => {
                callOrder.push(type);
                return {}; // both available
            }),
        };

        const result = detectWebGL(canvas);
        expect(result).toBe('webgl2');
        // Should only call webgl2 since it succeeded
        expect(callOrder).toEqual(['webgl2']);
    });
});

/**
 * Helper to create a mock WebGL context with the methods needed by FBO functions.
 */
function createMockGL() {
    const gl = {
        TEXTURE_2D: 0x0DE1,
        TEXTURE_MIN_FILTER: 0x2801,
        TEXTURE_MAG_FILTER: 0x2800,
        TEXTURE_WRAP_S: 0x2802,
        TEXTURE_WRAP_T: 0x2803,
        LINEAR: 0x2601,
        CLAMP_TO_EDGE: 0x812F,
        RGBA: 0x1908,
        UNSIGNED_BYTE: 0x1401,
        FRAMEBUFFER: 0x8D40,
        COLOR_ATTACHMENT0: 0x8CE0,
        createTexture: vi.fn(() => ({ _id: 'texture' })),
        bindTexture: vi.fn(),
        texParameteri: vi.fn(),
        texImage2D: vi.fn(),
        createFramebuffer: vi.fn(() => ({ _id: 'framebuffer' })),
        bindFramebuffer: vi.fn(),
        framebufferTexture2D: vi.fn(),
    };
    return gl;
}

describe('createFBO', () => {
    it('returns an object with fbo and texture properties', () => {
        const gl = createMockGL();
        const result = createFBO(gl, 800, 600);

        expect(result).toHaveProperty('fbo');
        expect(result).toHaveProperty('texture');
        expect(result.fbo._id).toBe('framebuffer');
        expect(result.texture._id).toBe('texture');
    });

    it('sets LINEAR filter for min and mag', () => {
        const gl = createMockGL();
        createFBO(gl, 256, 256);

        expect(gl.texParameteri).toHaveBeenCalledWith(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        expect(gl.texParameteri).toHaveBeenCalledWith(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    });

    it('sets CLAMP_TO_EDGE wrap for S and T', () => {
        const gl = createMockGL();
        createFBO(gl, 256, 256);

        expect(gl.texParameteri).toHaveBeenCalledWith(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        expect(gl.texParameteri).toHaveBeenCalledWith(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    });

    it('allocates texture with RGBA / UNSIGNED_BYTE at the given dimensions', () => {
        const gl = createMockGL();
        createFBO(gl, 1024, 768);

        expect(gl.texImage2D).toHaveBeenCalledWith(
            gl.TEXTURE_2D, 0, gl.RGBA, 1024, 768, 0, gl.RGBA, gl.UNSIGNED_BYTE, null
        );
    });

    it('attaches the texture to the framebuffer as COLOR_ATTACHMENT0', () => {
        const gl = createMockGL();
        const result = createFBO(gl, 512, 512);

        expect(gl.framebufferTexture2D).toHaveBeenCalledWith(
            gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, result.texture, 0
        );
    });

    it('unbinds framebuffer and texture after creation', () => {
        const gl = createMockGL();
        createFBO(gl, 100, 100);

        // Last bindFramebuffer call should unbind (null)
        const fbCalls = gl.bindFramebuffer.mock.calls;
        expect(fbCalls[fbCalls.length - 1]).toEqual([gl.FRAMEBUFFER, null]);

        // Last bindTexture call should unbind (null)
        const texCalls = gl.bindTexture.mock.calls;
        expect(texCalls[texCalls.length - 1]).toEqual([gl.TEXTURE_2D, null]);
    });
});

describe('resizeFBO', () => {
    it('binds the texture and calls texImage2D with new dimensions', () => {
        const gl = createMockGL();
        const texture = { _id: 'existingTexture' };
        const fbo = { _id: 'existingFBO' };

        resizeFBO(gl, fbo, texture, 1920, 1080);

        expect(gl.bindTexture).toHaveBeenCalledWith(gl.TEXTURE_2D, texture);
        expect(gl.texImage2D).toHaveBeenCalledWith(
            gl.TEXTURE_2D, 0, gl.RGBA, 1920, 1080, 0, gl.RGBA, gl.UNSIGNED_BYTE, null
        );
    });

    it('unbinds the texture after resizing', () => {
        const gl = createMockGL();
        const texture = { _id: 'tex' };
        const fbo = { _id: 'fbo' };

        resizeFBO(gl, fbo, texture, 640, 480);

        const texCalls = gl.bindTexture.mock.calls;
        expect(texCalls[texCalls.length - 1]).toEqual([gl.TEXTURE_2D, null]);
    });

    it('does not recreate the framebuffer or texture objects', () => {
        const gl = createMockGL();
        const texture = { _id: 'tex' };
        const fbo = { _id: 'fbo' };

        resizeFBO(gl, fbo, texture, 300, 200);

        expect(gl.createTexture).not.toHaveBeenCalled();
        expect(gl.createFramebuffer).not.toHaveBeenCalled();
    });
});
