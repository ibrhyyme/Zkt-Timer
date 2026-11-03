import React from 'react';

/**
 * True when at least one of `children` would actually render: not a React element with
 * `hidden` truthy, and not stripped out by React.Children.toArray in the first place
 * (null/false/undefined, e.g. a `{cond && <Row/>}` whose cond is false). Apart from
 * TimerSettingsRow so it stays unit-testable: the rows pull in a stylesheet through the
 * shared menu, and Jest has no stylesheet loader.
 */
export function hasVisibleSettingsRow(children: React.ReactNode): boolean {
	return React.Children.toArray(children).some((child) => {
		if (!React.isValidElement(child)) return true;
		return !(child.props as {hidden?: boolean}).hidden;
	});
}
