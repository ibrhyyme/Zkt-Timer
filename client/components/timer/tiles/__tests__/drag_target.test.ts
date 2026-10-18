import { allowsDragFrom, DragTargetEnv, isTileDragTarget } from '../drag_target';

// Minimal DOM stand-ins: the walk only reads nodeType, nodeName, getAttribute,
// isContentEditable and parentNode.
interface FakeNode {
	nodeType: number;
	nodeName: string;
	parentNode: FakeNode | null;
	attrs: Record<string, string>;
	isContentEditable?: boolean;
	scrolls?: boolean;
	/** Presses at or right of this x land on the node's scrollbar. */
	scrollbarFromX?: number;
	getAttribute(name: string): string | null;
}

function el(nodeName: string, parent: FakeNode | null, extra: Partial<FakeNode> = {}): FakeNode {
	const node: FakeNode = {
		nodeType: 1,
		nodeName,
		parentNode: parent,
		attrs: {},
		getAttribute(name: string) {
			return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
		},
		...extra,
	};
	return node;
}

const env: DragTargetEnv = {
	scrolls: (node: FakeNode) => !!node.scrolls,
	onScrollbar: (node: FakeNode, point) => node.scrollbarFromX !== undefined && point.x >= node.scrollbarFromX,
};

const mouseAt = (x: number) => ({ pointerType: 'mouse', x, y: 10 });
const touchAt = (x: number) => ({ pointerType: 'touch', x, y: 10 });

function buildTile() {
	const stage = el('DIV', null);
	const tile = el('DIV', stage);
	const head = el('DIV', tile);
	const body = el('DIV', tile);
	return { stage, tile, head, body };
}

describe('isTileDragTarget', () => {
	it('picks the module up by its header, body and padding', () => {
		const { tile, head, body } = buildTile();
		expect(isTileDragTarget(tile, tile, env)).toBe(true);
		expect(isTileDragTarget(head, tile, env)).toBe(true);
		expect(isTileDragTarget(body, tile, env)).toBe(true);
		expect(isTileDragTarget(el('SPAN', el('DIV', body)), tile, env)).toBe(true);
	});

	it('leaves controls alone, including anything inside them', () => {
		const { tile, head, body } = buildTile();
		const button = el('BUTTON', head);
		expect(isTileDragTarget(button, tile, env)).toBe(false);
		expect(isTileDragTarget(el('svg', button), tile, env)).toBe(false);
		expect(isTileDragTarget(el('INPUT', body), tile, env)).toBe(false);
		expect(isTileDragTarget(el('A', body), tile, env)).toBe(false);
	});

	it('leaves elements with an interactive role alone', () => {
		const { tile, body } = buildTile();
		const row = el('DIV', body, { attrs: { role: 'button' } });
		expect(isTileDragTarget(el('SPAN', row), tile, env)).toBe(false);
	});

	it('lets a click-only row opt in, but keeps the controls inside it', () => {
		const { tile, body } = buildTile();
		const row = el('DIV', body, { attrs: { role: 'button', 'data-tile-drag': '' } });
		expect(isTileDragTarget(el('SPAN', row), tile, env, mouseAt(10))).toBe(true);
		expect(isTileDragTarget(row, tile, env, mouseAt(10))).toBe(true);
		expect(isTileDragTarget(el('BUTTON', row), tile, env, mouseAt(10))).toBe(false);
		// The opt-in covers the row only, not an interactive role further up.
		const tab = el('DIV', body, { attrs: { role: 'tab' } });
		const optedRow = el('DIV', tab, { attrs: { role: 'button', 'data-tile-drag': '' } });
		expect(isTileDragTarget(optedRow, tile, env, mouseAt(10))).toBe(false);
	});

	it('leaves the 3D cube of the scramble preview alone', () => {
		const { tile, body } = buildTile();
		const player = el('TWISTY-PLAYER', el('DIV', body));
		expect(isTileDragTarget(player, tile, env)).toBe(false);
	});

	it('lets a static drawing (chart, 2D net) be grabbed', () => {
		const { tile, body } = buildTile();
		expect(isTileDragTarget(el('CANVAS', body), tile, env)).toBe(true);
		expect(isTileDragTarget(el('path', el('svg', body)), tile, env)).toBe(true);
	});

	it('leaves a list that scrolls alone, but not one that fits', () => {
		const { tile, body } = buildTile();
		const scrolling = el('DIV', body, { scrolls: true });
		const fitting = el('DIV', body, { scrolls: false });
		expect(isTileDragTarget(el('DIV', scrolling), tile, env)).toBe(false);
		expect(isTileDragTarget(el('DIV', scrolling), tile, env, touchAt(10))).toBe(false);
		expect(isTileDragTarget(el('DIV', scrolling), tile, env, { pointerType: 'pen', x: 10, y: 10 })).toBe(false);
		expect(isTileDragTarget(el('DIV', fitting), tile, env)).toBe(true);
	});

	it('lets a mouse grab a scrolling list anywhere but on its scrollbar', () => {
		const { tile, body } = buildTile();
		const list = el('DIV', body, { scrolls: true, scrollbarFromX: 300 });
		const row = el('DIV', list, { attrs: { role: 'button', 'data-tile-drag': '' } });
		expect(isTileDragTarget(el('SPAN', row), tile, env, mouseAt(120))).toBe(true);
		expect(isTileDragTarget(list, tile, env, mouseAt(305))).toBe(false);
		// Touch still scrolls the list instead.
		expect(isTileDragTarget(el('SPAN', row), tile, env, touchAt(120))).toBe(false);
	});

	it('honours the opt-out attribute and editable text', () => {
		const { tile, body } = buildTile();
		const resize = el('SPAN', tile, { attrs: { 'data-tile-nodrag': '' } });
		expect(isTileDragTarget(resize, tile, env)).toBe(false);
		expect(isTileDragTarget(el('DIV', body, { isContentEditable: true }), tile, env)).toBe(false);
	});

	it('never drags from outside the tile, such as a menu it opened in a portal', () => {
		const { stage, tile } = buildTile();
		const portalItem = el('DIV', el('DIV', stage));
		expect(isTileDragTarget(portalItem, tile, env)).toBe(false);
		expect(isTileDragTarget(null, tile, env)).toBe(false);
	});

	it('walks past text nodes', () => {
		const { tile, body } = buildTile();
		const text = { nodeType: 3, nodeName: '#text', parentNode: body } as any;
		expect(isTileDragTarget(text, tile, env)).toBe(true);
	});
});

describe('allowsDragFrom', () => {
	it('lets a floating module be grabbed anywhere, with any pointer', () => {
		expect(allowsDragFrom({ floating: true, pointerType: 'touch', inHeader: false })).toBe(true);
		expect(allowsDragFrom({ floating: true, pointerType: 'mouse', inHeader: false })).toBe(true);
	});

	it('lets a docked module be grabbed anywhere with a mouse', () => {
		expect(allowsDragFrom({ floating: false, pointerType: 'mouse', inHeader: false })).toBe(true);
	});

	it('keeps touch on a docked module for scrolling its column, except on the header', () => {
		expect(allowsDragFrom({ floating: false, pointerType: 'touch', inHeader: false })).toBe(false);
		expect(allowsDragFrom({ floating: false, pointerType: 'pen', inHeader: false })).toBe(false);
		expect(allowsDragFrom({ floating: false, pointerType: 'touch', inHeader: true })).toBe(true);
	});
});
