import React from 'react';
import block from '../../../../styles/bem';
import './StepTabs.scss';

const b = block('welcome-steps');

export interface StepTab {
	key: string;
	label: string;
	/** Sticker colour of the step. */
	color: string;
}

interface Props {
	items: StepTab[];
	active: number;
	onSelect: (index: number) => void;
	label: string;
	className?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The bar under a pinned scene: "03 / 06" and one tab per step, each with a bar over it
 * that fills as the visitor goes through. A tab jumps straight to its step.
 */
export default function StepTabs({items, active, onSelect, label, className}: Props) {
	return (
		<nav
			className={className ? `${b()} ${className}` : b()}
			aria-label={label}
			style={{'--count': items.length} as React.CSSProperties}
		>
			{/* Whole strings, one text node each: split children hydrate as a mismatch. */}
			<span className={b('count')}>
				{`${pad(active + 1)} `}
				<span className={b('total')}>{`/ ${pad(items.length)}`}</span>
			</span>
			<div className={b('list')} role="tablist">
				{items.map((item, i) => (
					<button
						key={item.key}
						type="button"
						role="tab"
						aria-selected={i === active}
						className={b('tab', {active: i === active, done: i < active})}
						onClick={() => onSelect(i)}
					>
						<span className={b('sticker')} style={{background: item.color}} />
						<span className={b('label')}>{item.label}</span>
					</button>
				))}
			</div>
		</nav>
	);
}
