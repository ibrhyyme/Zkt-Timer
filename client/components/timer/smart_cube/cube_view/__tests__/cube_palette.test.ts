import {STICKER_PALETTE, stickerPaletteFromFaceColors} from '../cube_palette';

describe('stickerPaletteFromFaceColors', () => {
	it('maps U R F D L B onto their sticker colours', () => {
		const palette = stickerPaletteFromFaceColors(['#000000', '#ff0000', '#00ff00', '#ffff00', '#ff8000', '#0000ff']);
		expect(palette.white).toEqual([0, 0, 0]);
		expect(palette.red).toEqual([255, 0, 0]);
		expect(palette.green).toEqual([0, 255, 0]);
		expect(palette.yellow).toEqual([255, 255, 0]);
		expect(palette.orange).toEqual([255, 128, 0]);
		expect(palette.blue).toEqual([0, 0, 255]);
	});

	it('keeps the app palette for a colour that is not #rrggbb', () => {
		const palette = stickerPaletteFromFaceColors(['white', '', '#12345', undefined as any, '#ff8000']);
		expect(palette.white).toEqual(STICKER_PALETTE.white);
		expect(palette.red).toEqual(STICKER_PALETTE.red);
		expect(palette.green).toEqual(STICKER_PALETTE.green);
		expect(palette.yellow).toEqual(STICKER_PALETTE.yellow);
		expect(palette.orange).toEqual([255, 128, 0]);
		expect(palette.blue).toEqual(STICKER_PALETTE.blue);
	});
});
