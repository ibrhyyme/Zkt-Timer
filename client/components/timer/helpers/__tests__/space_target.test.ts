import { claimSpaceForTimer, releaseFocusedButton, spaceOwnedByControl, timerOwnsSpaceKey } from '../space_target';

// Jest runs in node here, so targets are stand-ins that answer `closest` the way the DOM
// would for the element they describe.
function target(matches: string[]) {
	const el = {
		blurred: false,
		blur() {
			el.blurred = true;
		},
		closest(selector: string) {
			return selector.split(',').some((s) => matches.includes(s.trim())) ? el : null;
		},
	};
	return el;
}

describe('spaceOwnedByControl', () => {
	// The reported bug: timer type picker open, Space picks the focused option. Radix calls
	// preventDefault when it acts on Space, so the timer must leave that press alone.
	it('gives the press to a control that already handled it', () => {
		expect(spaceOwnedByControl({ defaultPrevented: true, target: target([]) })).toBe(true);
	});

	it('gives the press to an open picker or menu even if nothing prevented it', () => {
		expect(spaceOwnedByControl({ defaultPrevented: false, target: target(['[role="option"]']) })).toBe(true);
		expect(spaceOwnedByControl({ defaultPrevented: false, target: target(['[role="listbox"]']) })).toBe(true);
		expect(spaceOwnedByControl({ defaultPrevented: false, target: target(['[role="menuitem"]']) })).toBe(true);
	});

	it('leaves an ordinary press to the timer', () => {
		expect(spaceOwnedByControl({ defaultPrevented: false, target: target([]) })).toBe(false);
		// A plain button (+2, DNF) is not a menu: the timer takes the press and releases the button.
		expect(spaceOwnedByControl({ defaultPrevented: false, target: target(['button']) })).toBe(false);
	});

	it('copes with a target that is not an element', () => {
		expect(spaceOwnedByControl({ defaultPrevented: false, target: null })).toBe(false);
		expect(spaceOwnedByControl({ defaultPrevented: false, target: {} })).toBe(false);
	});
});

describe('releaseFocusedButton', () => {
	// A button focused by a mouse click would be activated by the keyup of the Space that
	// starts the next solve, e.g. toggling +2 on the previous solve again.
	it('blurs a focused button the press landed on', () => {
		const button = target(['button']);
		releaseFocusedButton({ target: button });
		expect(button.blurred).toBe(true);
	});

	it('leaves anything that is not a button alone', () => {
		const div = target([]);
		releaseFocusedButton({ target: div });
		expect(div.blurred).toBe(false);
		expect(() => releaseFocusedButton({ target: null })).not.toThrow();
	});
});

describe('claimSpaceForTimer', () => {
	it('owns Space only while claimed, and a double release does not go negative', () => {
		expect(timerOwnsSpaceKey()).toBe(false);
		const release = claimSpaceForTimer();
		expect(timerOwnsSpaceKey()).toBe(true);
		release();
		release();
		expect(timerOwnsSpaceKey()).toBe(false);
	});

	it('stays claimed while any claim is still held', () => {
		const a = claimSpaceForTimer();
		const b = claimSpaceForTimer();
		a();
		expect(timerOwnsSpaceKey()).toBe(true);
		b();
		expect(timerOwnsSpaceKey()).toBe(false);
	});
});
