import React from 'react';
import {useColor} from '../../../../util/hooks/useTheme';
import {ColorName} from '../../../../../shared/colors';
import block from '../../../../styles/bem';

const b = block('customize-stats');

interface Props {
	selected?: boolean;
	disabled?: boolean;
	colorName: ColorName;
	onSelectColor: (colorName: ColorName) => void;
}

export default function CustomizeStatsColor(props: Props) {
	const {onSelectColor, selected, disabled, colorName} = props;
	// The hex the stats module draws the value in (QuickStatsBlock asks for the same).
	const colorHex = useColor(colorName, 'button_color');

	return (
		<button
			type="button"
			role="radio"
			aria-checked={!!selected}
			aria-label={colorName}
			title={colorName}
			disabled={disabled}
			style={{backgroundColor: colorHex?.hex}}
			onClick={() => !selected && onSelectColor(colorName)}
			className={b('swatch', {selected})}
		/>
	);
}
