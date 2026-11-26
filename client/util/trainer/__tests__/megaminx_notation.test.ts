/**
 * Megaminx and 5x5 categories (SpeedCubeDB phase 2): the engine keeps megaminx faces as one
 * move, cubing.js gets its own face names, and a megaminx half turn keeps its direction.
 */
import {expandNotation, getPuzzleType, isCubeShapePuzzle, twistyAlg, twistyStickering} from '../algorithm_engine';

describe('megaminx notation', () => {
	it('keeps two letter megaminx faces as one move', () => {
		expect(expandNotation("R' F R BR' R' F' R BR")).toBe("R' F R BR' R' F' R BR");
		expect(expandNotation("y2' R2' DR' R U2 R' DR R U2' R")).toBe("y2' R2' DR' R U2 R' DR R U2' R");
		expect(expandNotation("(BR' R) BL2'")).toBe("(BR' R) BL2'");
	});

	it('still reads a 3x3 text typed without spaces as single faces', () => {
		expect(expandNotation("RBR'")).toBe("R B R'");
		expect(expandNotation("FRUR'U'F'")).toBe("F R U R' U' F'");
	});

	it("hands cubing.js its own name for SpeedCubeDB's DR face, on megaminx only", () => {
		expect(twistyAlg('Megaminx PLL', "R' DR R U' R' DR' R")).toBe("R' FR R U' R' FR' R");
		expect(twistyAlg('Megaminx OLL', "BR' U' R' U R BR")).toBe("BR' U' R' U R BR");
		expect(twistyAlg('PLL', "R U R'")).toBe("R U R'");
	});

	it('maps the puzzle and the stickering', () => {
		expect(getPuzzleType('Megaminx OLL')).toBe('megaminx');
		expect(getPuzzleType('5x5 L2E')).toBe('5x5x5');
		expect(isCubeShapePuzzle('5x5 L2C')).toBe(true);
		expect(isCubeShapePuzzle('Megaminx PLL')).toBe(false);
		expect(twistyStickering('Megaminx EO')).toBe('EOLL');
		expect(twistyStickering('Megaminx CO')).toBe('OLL');
		expect(twistyStickering('Megaminx CP')).toBe('PLL');
		expect(twistyStickering('5x5 L2C')).toBe('full');
		expect(twistyStickering('OLL')).toBe('OLL');
		expect(twistyStickering('2x2 CLL')).toBe('full');
	});
});
