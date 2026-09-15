/**
 * Who a Space press belongs to on the timer page.
 *
 * KeyWatcher listens on window, so it sees Space after every focused control has had
 * it. Two ways that went wrong: with a header picker open, one press chose the focused
 * option AND primed the timer; and a button left focused by a mouse click (+2, DNF, a
 * picker's trigger) was activated by the same press that started the next solve.
 */

/** Anything inside an open picker or menu. */
const MENU_SELECTOR = '[role="listbox"], [role="menu"], [role="option"], [role="menuitem"], [data-radix-popper-content-wrapper]';

/** Controls the browser activates with Space. */
const BUTTON_SELECTOR = 'button, a[href], [role="button"], summary';

interface KeyEventLike {
	defaultPrevented: boolean;
	target: unknown;
}

type ClosestTarget = { closest?: (selector: string) => unknown } | null | undefined;

function closest(target: unknown, selector: string): unknown {
	const t = target as ClosestTarget;
	return t && typeof t.closest === 'function' ? t.closest(selector) : null;
}

/**
 * True when a focused control already used this Space (a Radix picker opens on it and
 * picks an option with it, calling preventDefault either way), or when focus is inside
 * an open picker or menu. The press is the control's then, not the timer's.
 */
export function spaceOwnedByControl(e: KeyEventLike): boolean {
	if (e.defaultPrevented) return true;
	return !!closest(e.target, MENU_SELECTOR);
}

/**
 * Takes focus off a plain button the press landed on, so the browser does not activate
 * it when the key comes up. Called only once the timer has decided the press is its own.
 */
export function releaseFocusedButton(e: { target: unknown }): void {
	const button = closest(e.target, BUTTON_SELECTOR) as { blur?: () => void } | null;
	if (button && typeof button.blur === 'function') button.blur();
}

let spaceClaims = 0;

/**
 * Marks Space as the timer's key while the returned release has not been called.
 * KeyWatcher claims it for as long as it is mounted.
 */
export function claimSpaceForTimer(): () => void {
	spaceClaims++;
	let released = false;
	return () => {
		if (released) return;
		released = true;
		spaceClaims = Math.max(0, spaceClaims - 1);
	};
}

/**
 * Whether a picker closing should skip handing focus back to its trigger. Radix does
 * that by default, which is right for keyboard users anywhere else, but on the timer
 * page it left the trigger focused and the next Space opened the picker again instead
 * of starting the solve.
 */
export function timerOwnsSpaceKey(): boolean {
	return spaceClaims > 0;
}
