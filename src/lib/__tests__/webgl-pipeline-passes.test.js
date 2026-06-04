import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uploadTexture, runPass, state } from '../webgl-pipeline.js';

/**
 * Creates a mock WebGL context with all methods needed by uploadTexture and runPass.
 */
function createMockGL() {
    const gl = {
        TEXTURE_2D: 0x0DE1,
        TEXTURE0: 0x84C0,
        RGBA: 0x1908,
        UNSIGNED_BYTE: 0x1401,
        FRAMEBUFFER: 0x8D40,
        ARRAY_BUFFER: 0x8892,
        FLOAT: 0x1406,
        TRIANGLES: 0x0004,
        bindTexture: vi.fn(),
        texImage2D: vi.fn(),
        useProgram: vi.fn(),
        bindFramebuffer: vi.fn(),
        viewport: vi.fn(),
        getUniformLocation: vi.fn(),
        activeTexture: vi.fn(),
        uniform1i: vi.fn(),
        uniform1f: vi.fn(),
        uniform2fv: vi.fn(),
        uniform3fv: vi.fn(),
        bindBuffer: vi.fn(),
        getAttribLocation: vi.fn().mockReturnValue(0),
        enableVertexAttribArray: vi.fn(),
        vertexAttribPointer: vi.fn(),
        drawArrays: vi.fn(),
    };
    return gl;
}

describe('uploadTexture', () => {
    it('binds the texture and calls texImage2D with the source image', () => {
        const gl = createMockGL();
        const texture = { _id: 'tex1' };
        const image = { width: 100, height: 100 };

        uploadTexture(gl, texture, image, 100, 100);

        expect(gl.bindTexture).toHaveBeenCalledWith(gl.TEXTURE_2D, texture);
        expect(gl.texImage2D).toHaveBeenCalledWith(
            gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image
        );
    });

    it('passes the image directly regardless of w/h values', () => {
        const gl = createMockGL();
        const texture = { _id: 'tex2' };
        const image = { width: 200, height: 150 };

        uploadTexture(gl, texture, image, 50, 50);

        // texImage2D is called with the image directly, not w/h
        expect(gl.texImage2D).toHaveBeenCalledWith(
            gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image
        );
    });
});

describe('runPass', () => {
    let gl;
    let mockProgram;
    let savedQuadVBO;

    beforeEach(() => {
        gl = createMockGL();
        mockProgram = { _id: 'program1' };
        // Save and set up state.quadVBO for the test
        savedQuadVBO = state.quadVBO;
        state.quadVBO = { _id: 'quadVBO' };
        // Mock getUniformLocation to return a location for known uniforms
        gl.getUniformLocation.mockImplementation((prog, name) => {
            return { name }; // return a truthy location object
        });
    });

    // Restore state after each test
    afterEach(() => {
        state.quadVBO = savedQuadVBO;
    });

    it('binds the program with useProgram', () => {
        runPass(gl, mockProgram, null, 800, 600, {});
        expect(gl.useProgram).toHaveBeenCalledWith(mockProgram);
    });

    it('binds the default framebuffer when dstFBO is null', () => {
        runPass(gl, mockProgram, null, 800, 600, {});
        expect(gl.bindFramebuffer).toHaveBeenCalledWith(gl.FRAMEBUFFER, null);
    });

    it('binds the FBO when dstFBO is provided', () => {
        const dstFBO = { fbo: { _id: 'fbo1' }, texture: { _id: 'tex1' } };
        runPass(gl, mockProgram, dstFBO, 800, 600, {});
        expect(gl.bindFramebuffer).toHaveBeenCalledWith(gl.FRAMEBUFFER, dstFBO.fbo);
    });

    it('sets viewport to (0, 0, w, h)', () => {
        runPass(gl, mockProgram, null, 1024, 768, {});
        expect(gl.viewport).toHaveBeenCalledWith(0, 0, 1024, 768);
    });

    it('uploads float uniforms with uniform1f', () => {
        runPass(gl, mockProgram, null, 100, 100, { u_threshold: 0.5 });
        expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'u_threshold' }, 0.5);
    });

    it('uploads boolean uniforms with uniform1i (true → 1, false → 0)', () => {
        runPass(gl, mockProgram, null, 100, 100, { u_colorize: true });
        expect(gl.uniform1i).toHaveBeenCalledWith({ name: 'u_colorize' }, 1);

        gl.uniform1i.mockClear();
        gl.getUniformLocation.mockImplementation((prog, name) => ({ name }));
        runPass(gl, mockProgram, null, 100, 100, { u_colorize: false });
        expect(gl.uniform1i).toHaveBeenCalledWith({ name: 'u_colorize' }, 0);
    });

    it('uploads vec2 uniforms with uniform2fv', () => {
        runPass(gl, mockProgram, null, 100, 100, { u_texelSize: [0.01, 0.02] });
        expect(gl.uniform2fv).toHaveBeenCalledWith({ name: 'u_texelSize' }, [0.01, 0.02]);
    });

    it('uploads vec3 uniforms with uniform3fv', () => {
        runPass(gl, mockProgram, null, 100, 100, { u_tintcolor: [1.0, 0.5, 0.0] });
        expect(gl.uniform3fv).toHaveBeenCalledWith({ name: 'u_tintcolor' }, [1.0, 0.5, 0.0]);
    });

    it('uploads sampler2D (texture object) by binding to texture unit', () => {
        const textureObj = { _id: 'someTexture' }; // object = treated as texture
        runPass(gl, mockProgram, null, 100, 100, { u_source: textureObj });

        expect(gl.activeTexture).toHaveBeenCalledWith(gl.TEXTURE0);
        expect(gl.bindTexture).toHaveBeenCalledWith(gl.TEXTURE_2D, textureObj);
        expect(gl.uniform1i).toHaveBeenCalledWith({ name: 'u_source' }, 0);
    });

    it('skips uniforms with null location', () => {
        gl.getUniformLocation.mockReturnValue(null);
        runPass(gl, mockProgram, null, 100, 100, { u_missing: 0.5 });
        expect(gl.uniform1f).not.toHaveBeenCalled();
    });

    it('binds the fullscreen quad VBO and enables vertex attribute', () => {
        runPass(gl, mockProgram, null, 100, 100, {});
        expect(gl.bindBuffer).toHaveBeenCalledWith(gl.ARRAY_BUFFER, state.quadVBO);
        expect(gl.getAttribLocation).toHaveBeenCalledWith(mockProgram, 'a_position');
        expect(gl.enableVertexAttribArray).toHaveBeenCalledWith(0);
        expect(gl.vertexAttribPointer).toHaveBeenCalledWith(0, 2, gl.FLOAT, false, 0, 0);
    });

    it('calls drawArrays with TRIANGLES mode and 6 vertices', () => {
        runPass(gl, mockProgram, null, 100, 100, {});
        expect(gl.drawArrays).toHaveBeenCalledWith(gl.TRIANGLES, 0, 6);
    });

    it('handles multiple texture uniforms on different texture units', () => {
        const tex1 = { _id: 'tex1' };
        const tex2 = { _id: 'tex2' };
        runPass(gl, mockProgram, null, 100, 100, { u_base: tex1, u_glow: tex2 });

        expect(gl.activeTexture).toHaveBeenCalledWith(gl.TEXTURE0);
        expect(gl.activeTexture).toHaveBeenCalledWith(gl.TEXTURE0 + 1);
        expect(gl.bindTexture).toHaveBeenCalledWith(gl.TEXTURE_2D, tex1);
        expect(gl.bindTexture).toHaveBeenCalledWith(gl.TEXTURE_2D, tex2);
        expect(gl.uniform1i).toHaveBeenCalledWith({ name: 'u_base' }, 0);
        expect(gl.uniform1i).toHaveBeenCalledWith({ name: 'u_glow' }, 1);
    });

    it('handles mixed uniform types in a single call', () => {
        runPass(gl, mockProgram, null, 100, 100, {
            u_threshold: 0.8,
            u_colorize: true,
            u_texelSize: [0.001, 0.002],
            u_tintcolor: [1.0, 0.5, 0.0],
        });

        expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'u_threshold' }, 0.8);
        expect(gl.uniform1i).toHaveBeenCalledWith({ name: 'u_colorize' }, 1);
        expect(gl.uniform2fv).toHaveBeenCalledWith({ name: 'u_texelSize' }, [0.001, 0.002]);
        expect(gl.uniform3fv).toHaveBeenCalledWith({ name: 'u_tintcolor' }, [1.0, 0.5, 0.0]);
    });
});
