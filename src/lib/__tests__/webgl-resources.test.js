import { describe, it, expect, vi } from 'vitest';
import { detectWebGL } from '../webgl-resources.js';

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
