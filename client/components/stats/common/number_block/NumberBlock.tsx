import React, { ReactNode, useCallback } from 'react';
import './NumberBlock.scss';
import block from '../../../../styles/bem';
import CSS from 'csstype';
import StatModule from '../stat_module/StatModule';
import { useMe } from '../../../../util/hooks/useMe';
import { isNotPro } from '../../../../util/pro';
import CountUp from '../count_up/CountUp';
import { useTranslation } from 'react-i18next';
import { formatDurationText, formatInteger } from '../../../../util/locale_format';

const b = block('number-block');

/**
 * Icon colour for a stat with nothing to highlight. Only the icon takes it: the value
 * itself is drawn in the theme's text colour, because grey values read as disabled
 * (the faded-text rule) and grey on the module background had poor contrast.
 */
export const NEUTRAL_STAT_COLOR = '#6D7D90';

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
function parseAnimatableValue(value: string | number): { to: number; decimals: number } | null {
	if (typeof value === 'number') {
		return { to: value, decimals: 0 };
	}

	// Simple decimal number like "12.34" or "0.92": a solve time, which keeps its point
	if (/^\d+\.\d+$/.test(value)) {
		const decimals = value.split('.')[1].length;
		return { to: parseFloat(value), decimals };
	}

	// Plain integer string like "1523"
	if (/^\d+$/.test(value)) {
		return { to: parseInt(value, 10), decimals: 0 };
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

	const { t, i18n } = useTranslation();
	const language = i18n.language;

	// Total cubing time reads as words ("1 gün 15 sa 37 dk"), not as a stopwatch ("1d 15:37")
	const timeFormatter = useCallback((seconds: number) => formatDurationText(seconds, t), [t, language]);
	// Counts are grouped in the app's language: "12.450" in Turkish, "12,450" in English
	const integerFormatter = useCallback((value: number) => formatInteger(Math.round(value), language), [language]);

	let displayValue: string;
	if (typeof props.value === 'number') {
		displayValue = formatInteger(props.value, language);
	} else {
		displayValue = props.value;
	}

	const style: CSS.Properties = {
		color: color === NEUTRAL_STAT_COLOR ? 'rgb(var(--text-color))' : color,
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
							formatFn={animatable.decimals === 0 ? integerFormatter : undefined}
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
