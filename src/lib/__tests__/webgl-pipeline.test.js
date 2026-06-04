import { describe, it, expect } from 'vitest';
import { parseTintColor } from '../webgl-pipeline.js';

describe('parseTintColor', () => {
    it('parses #000000 to [0, 0, 0]', () => {
        const result = parseTintColor('#000000');
        expect(result).toEqual([0, 0, 0]);
    });

    it('parses #FFFFFF to [1, 1, 1]', () => {
        const result = parseTintColor('#FFFFFF');
        expect(result).toEqual([1, 1, 1]);
    });

    it('parses #FF0000 to [1, 0, 0]', () => {
        const result = parseTintColor('#FF0000');
        expect(result).toEqual([1, 0, 0]);
    });

    it('parses #00FF00 to [0, 1, 0]', () => {
        const result = parseTintColor('#00FF00');
        expect(result).toEqual([0, 1, 0]);
    });

    it('parses #0000FF to [0, 0, 1]', () => {
        const result = parseTintColor('#0000FF');
        expect(result).toEqual([0, 0, 1]);
    });

    it('parses #FF8800 to normalized values', () => {
        const result = parseTintColor('#FF8800');
        expect(result[0]).toBeCloseTo(1.0);
        expect(result[1]).toBeCloseTo(0x88 / 255);
        expect(result[2]).toBeCloseTo(0);
    });

    it('handles lowercase hex strings', () => {
        const result = parseTintColor('#ff8800');
        expect(result[0]).toBeCloseTo(1.0);
        expect(result[1]).toBeCloseTo(0x88 / 255);
        expect(result[2]).toBeCloseTo(0);
    });

    it('returns values in [0, 1] range', () => {
        const result = parseTintColor('#7F7F7F');
        for (const channel of result) {
            expect(channel).toBeGreaterThanOrEqual(0);
            expect(channel).toBeLessThanOrEqual(1);
        }
    });
});
