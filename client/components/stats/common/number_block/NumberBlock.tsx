import React, { ReactNode, useCallback } from 'react';
import './NumberBlock.scss';
import block from '../../../../styles/bem';
import CSS from 'csstype';
import StatModule from '../stat_module/StatModule';
import { useMe } from '../../../../util/hooks/useMe';
import { isNotPro } from '../../../../util/pro';
import CountUp from '../count_up/CountUp';
import { getTimeString } from '../../../../util/time';

const b = block('number-block');

interface Props {
	icon: React.ReactElement;
	title: string;
	color: string;
	value: string | number;
	darkIcon?: boolean;
	rowSpan?: number;
	vertical?: boolean;
	colSpan?: number;
	noPadding?: boolean;
	small?: boolean;
	style?: CSS.Properties;
	proOnly?: boolean;
	center?: boolean;
	large?: boolean;
	children?: ReactNode;
	onClick?: () => void;
	/** Raw seconds value for animated time display (e.g. cubing time) */
	animateSeconds?: number;
}

/**
 * Checks if a value can be animated with CountUp.
 * Returns the numeric value and decimal count if animatable.
 */
function parseAnimatableValue(value: string | number): { to: number; decimals: number; separator: string } | null {
	if (typeof value === 'number') {
		return { to: value, decimals: 0, separator: ',' };
	}

	// Simple decimal number like "12.34" or "0.92"
	if (/^\d+\.\d+$/.test(value)) {
		const decimals = value.split('.')[1].length;
		return { to: parseFloat(value), decimals, separator: '' };
	}

	// Plain integer string like "1523"
	if (/^\d+$/.test(value)) {
		return { to: parseInt(value, 10), decimals: 0, separator: ',' };
	}

	// Non-animatable: "-", "DNF", "1:02.34", "5 days", etc.
	return null;
}

export default function NumberBlock(props: Props) {
	const me = useMe();

	const {
		icon,
		color,
		title,
		onClick,
		large,
		noPadding,
		darkIcon,
		vertical,
		center,
		proOnly,
		children,
		small,
		rowSpan,
		colSpan,
		animateSeconds,
	} = props;

	const timeFormatter = useCallback((seconds: number) => getTimeString(seconds, undefined, true), []);

	let displayValue: string;
	if (typeof props.value === 'number') {
		displayValue = props.value.toLocaleString();
	} else {
		displayValue = props.value;
	}

	const style: CSS.Properties = {
		color,
		...props.style,
	};
	if (rowSpan) {
		style.gridRow = `span ${rowSpan}`;
	}
	if (colSpan) {
		style.gridColumn = `span ${colSpan}`;
	}

	const isProGated = proOnly && isNotPro(me);
	if (isProGated) {
		displayValue = '-';
	}

	const animatable = !isProGated ? parseAnimatableValue(props.value) : null;
	const hasAnimateSeconds = !isProGated && animateSeconds != null && animateSeconds > 0;

	return (
		<StatModule className={b({ center, vertical, noPadding, large, small, button: !!onClick })} style={style}>
			<div className={b('body')}>
				<button className={b('value', { clickable: !!onClick })} onClick={onClick}>
					<div className={b('header')}>
						<div className={b('icon', { darkIcon })} style={{ backgroundColor: color }}>
							{icon}
						</div>
						<p>{title}</p>
					</div>
					{hasAnimateSeconds ? (
						<CountUp
							to={animateSeconds}
							formatFn={timeFormatter}
							duration={0.5}
						/>
					) : animatable ? (
						<CountUp
							to={animatable.to}
							decimals={animatable.decimals}
							separator={animatable.separator}
							duration={0.5}
						/>
					) : (
						<span>{displayValue}</span>
					)}
				</button>
			</div>
			{children}
		</StatModule>
	);
}
