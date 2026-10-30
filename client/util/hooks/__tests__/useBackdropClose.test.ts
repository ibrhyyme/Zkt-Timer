import React from 'react';
import {renderToString} from 'react-dom/server';
import {useBackdropClose} from '../useBackdropClose';

const backdrop = {};
const input = {};

function handlersFor(onClose: () => void) {
	let handlers: ReturnType<typeof useBackdropClose>;
	function Probe() {
		handlers = useBackdropClose(onClose);
		return null;
	}
	renderToString(React.createElement(Probe));
	return handlers;
}

// The backdrop sees the press (capture phase) and then the click the browser sends it.
function press(handlers: ReturnType<typeof useBackdropClose>, downOn: object, clickOn: object) {
	handlers.onPointerDownCapture({target: downOn, currentTarget: backdrop} as any);
	handlers.onClick({target: clickOn, currentTarget: backdrop} as any);
}

describe('useBackdropClose', () => {
	it('closes on a press and release on the backdrop', () => {
		const onClose = jest.fn();
		press(handlersFor(onClose), backdrop, backdrop);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('stays open when a text selection started in an input ends on the backdrop', () => {
		const onClose = jest.fn();
		press(handlersFor(onClose), input, backdrop);
		expect(onClose).not.toHaveBeenCalled();
	});

	it('stays open on a click inside the content', () => {
		const onClose = jest.fn();
		press(handlersFor(onClose), input, input);
		expect(onClose).not.toHaveBeenCalled();
	});

	it('forgets a backdrop press once its click is handled', () => {
		const onClose = jest.fn();
		const handlers = handlersFor(onClose);
		handlers.onPointerDownCapture({target: backdrop, currentTarget: backdrop} as any);
		handlers.onClick({target: input, currentTarget: backdrop} as any);
		handlers.onClick({target: backdrop, currentTarget: backdrop} as any);
		expect(onClose).not.toHaveBeenCalled();
	});
});
