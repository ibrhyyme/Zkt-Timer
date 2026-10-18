import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ColorPicker as ColorPalette, ColorService, IColor} from 'react-color-palette';
import './ColorPicker.scss';
import block from '../../../styles/bem';
import {useToggle} from '../../../util/hooks/useToggle';
import {useWindowClickAwayListener} from '../../../util/hooks/useListener';
import Button from '../button/Button';
import {colorStringsEqual, getAnyColorStringAsRawRgbString, getAnyColorStringAsRgb} from '../../../util/themes/theme_util';

const b = block('common-color-picker');

// The palette works in an opaque colour model; every setting stored here is plain "r, g, b".
function toPaletteColor(input: string): IColor {
	return ColorService.convert('rgb', {...getAnyColorStringAsRgb(input), a: 1});
}

interface Props {
	openUp?: boolean;
	resetToRgb?: string;
	openLeft?: boolean;
	name?: string;
	hideReset?: boolean;
	onChange: (colorRgb: string) => void;
	selectedColorHex: string;
	isOpen?: boolean;
	onToggle?: () => void;
}

export default function ColorPicker(props: Props) {
	const {t} = useTranslation();
	const {name, hideReset, onChange, openUp, openLeft, resetToRgb, isOpen, onToggle} = props;
	const selectedColorHex = props.selectedColorHex || '#000000';

	const controlled = isOpen !== undefined;
	const [showPickerInternal, toggleShowPickerInternal] = useToggle(false);
	const [color, setColor] = useState<IColor>(() => toPaletteColor(selectedColorHex));

	const showPicker = controlled ? isOpen : showPickerInternal;

	function handleToggle() {
		if (controlled && onToggle) {
			onToggle();
		} else {
			toggleShowPickerInternal();
		}
	}

	useEffect(() => {
		setColor(toPaletteColor(selectedColorHex));
	}, [selectedColorHex]);

	useWindowClickAwayListener(b(), () => {
		if (showPicker) {
			onChange(getAnyColorStringAsRawRgbString(color));
			handleToggle();
		}
	});

	function colorChange(c: IColor) {
		setColor(c);
		onChange(getAnyColorStringAsRawRgbString(c));
	}

	let resetButton = null;
	if (resetToRgb && !hideReset) {
		resetButton = (
			<Button
				hidden={colorStringsEqual(resetToRgb, color)}
				text={t('common.reset')}
				warning
				flat
				onClick={() => {
					const newColor = toPaletteColor(resetToRgb);
					setColor(newColor);
					onChange(getAnyColorStringAsRawRgbString(newColor));
				}}
			/>
		);
	}

	return (
		<div className={b()}>
			<button className={b('toggle')} onClick={handleToggle}>
				<span
					className={b('color')}
					style={{
						backgroundColor: color.hex,
					}}
				/>
				<p>{name || 'Select color'}</p>
			</button>
			{resetButton}
			<div className={b('palette', {hidden: !showPicker, up: openUp, left: openLeft})}>
				{/* 7.x, not 6.x: 6.x only listened to the mouse, so on a phone neither the
				    saturation square nor the hue bar followed a finger. Width comes from the
				    palette box in ColorPicker.scss, the light/dark colours from there too. */}
				<ColorPalette
					height={150}
					color={color}
					onChange={colorChange}
					hideAlpha
					hideInput={['rgb', 'hsv']}
				/>
				<div style={{padding: '8px', textAlign: 'center'}}>
					<Button
						small
						text={t('common.close')}
						onClick={handleToggle}
					/>
				</div>
			</div>
		</div>
	);
}
