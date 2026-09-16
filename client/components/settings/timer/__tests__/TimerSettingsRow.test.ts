import React from 'react';
import {hasVisibleSettingsRow} from '../TimerSettingsRow';

// TimerSettingsGroup (client/components/settings/timer/TimerSettingsRow.tsx) used to render
// its header unconditionally even when every row inside it was individually hidden (e.g.
// Input settings' "Sanal Küp" / Virtual Cube group, all five rows gated on
// `hidden={!isVirtual}`), leaving a section title with nothing underneath.
// hasVisibleSettingsRow is the extracted predicate that decides whether the group has
// anything left to show.
describe('hasVisibleSettingsRow', () => {
	it('is true when at least one row has no hidden prop', () => {
		const children = [
			React.createElement('div', {key: 'a', hidden: true}),
			React.createElement('div', {key: 'b'}),
		];
		expect(hasVisibleSettingsRow(children)).toBe(true);
	});

	it('is true when at least one row has hidden explicitly false', () => {
		const children = [
			React.createElement('div', {key: 'a', hidden: true}),
			React.createElement('div', {key: 'b', hidden: false}),
		];
		expect(hasVisibleSettingsRow(children)).toBe(true);
	});

	it('is false when every row is hidden (the Virtual Cube case)', () => {
		const children = [
			React.createElement('div', {key: 'a', hidden: true}),
			React.createElement('div', {key: 'b', hidden: true}),
			React.createElement('div', {key: 'c', hidden: true}),
		];
		expect(hasVisibleSettingsRow(children)).toBe(false);
	});

	it('is false for no children at all', () => {
		expect(hasVisibleSettingsRow(null)).toBe(false);
		expect(hasVisibleSettingsRow(undefined)).toBe(false);
		expect(hasVisibleSettingsRow([])).toBe(false);
	});

	it('is false when a conditional child evaluates to false/null instead of using hidden', () => {
		const condition = false;
		const children = [
			condition && React.createElement('div', {key: 'a'}),
			null,
		];
		expect(hasVisibleSettingsRow(children)).toBe(false);
	});

	it('treats a single non-hidden row as visible', () => {
		expect(hasVisibleSettingsRow(React.createElement('div', {key: 'a'}))).toBe(true);
	});
});
