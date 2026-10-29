// Tabs as words over a hairline, the selected one underlined in the user's accent. For
// switching between views of one thing (a solve's overview, stats and solution), where
// HorizontalNav's large filled buttons read as a row of actions and outweighed the content.

import React from 'react';
import './TabBar.scss';
import block from '../../../styles/bem';

const b = block('tab-bar');

export interface TabBarTab<T extends string> {
	id: T;
	label: string;
}

interface Props<T extends string> {
	tabs: TabBarTab<T>[];
	value: T;
	onChange: (id: T) => void;
	/** Names the tab list for a screen reader. */
	label: string;
	className?: string;
}

export default function TabBar<T extends string>(props: Props<T>) {
	const {tabs, value, onChange, label, className} = props;

	return (
		<div role="tablist" aria-label={label} className={b() + (className ? ' ' + className : '')}>
			{tabs.map((tab) => {
				const selected = tab.id === value;
				return (
					<button
						type="button"
						role="tab"
						aria-selected={selected}
						key={tab.id}
						className={b('tab', {selected})}
						onClick={() => !selected && onChange(tab.id)}
					>
						{tab.label}
					</button>
				);
			})}
		</div>
	);
}
