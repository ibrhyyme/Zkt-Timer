import React from 'react';
import { useTranslation } from 'react-i18next';
import { CaretDown } from 'phosphor-react';
import FancyDropdown, { FancyDropdownOption } from './FancyDropdown';
import { TopColorFace } from '../../../util/scramble_transform';

interface Props {
	value: TopColorFace | null;
	onChange: (next: TopColorFace) => void;
	mobile?: boolean;
}

const COLOR_OPTIONS: { face: TopColorFace; labelKey: string; color: string }[] = [
	{ face: 'U', labelKey: 'face_u', color: '#ffffff' },
	{ face: 'D', labelKey: 'face_d', color: '#ffd500' },
	{ face: 'R', labelKey: 'face_r', color: '#c41e3a' },
	{ face: 'L', labelKey: 'face_l', color: '#ff5800' },
	{ face: 'F', labelKey: 'face_f', color: '#009e60' },
	{ face: 'B', labelKey: 'face_b', color: '#0051ba' },
];

function ColorSwatch({ color, size = 14 }: { color: string; size?: number }) {
	return (
		<span
			style={{
				display: 'inline-block',
				width: size,
				height: size,
				borderRadius: 3,
				background: color,
				border: '1px solid rgba(255,255,255,0.25)',
				verticalAlign: 'middle',
				flexShrink: 0,
			}}
		/>
	);
}

export default function CrossColorPicker({ value, onChange }: Props) {
	const { t } = useTranslation();

	const effectiveValue: TopColorFace = value || 'U';
	const current = COLOR_OPTIONS.find((o) => o.face === effectiveValue) || COLOR_OPTIONS[0];

	const options: FancyDropdownOption[] = COLOR_OPTIONS.map((opt) => ({
		value: opt.face,
		label: t(`trainer.${opt.labelKey}`),
		icon: <ColorSwatch color={opt.color} />,
	}));

	function handleValueChange(newValue: string) {
		onChange(newValue as TopColorFace);
	}

	// Trigger: swatch + harf + caret (sadece icon-text-caret)
	const triggerContent = (
		<>
			<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
				<ColorSwatch color={current.color} />
				<span style={{ fontWeight: 600 }}>{current.face}</span>
			</span>
			<CaretDown weight="bold" size={12} style={{ color: 'rgba(var(--text-color), 0.5)', marginLeft: 6 }} />
		</>
	);

	return (
		<FancyDropdown
			value={effectiveValue}
			onValueChange={handleValueChange}
			options={options}
			triggerContent={triggerContent}
			ariaLabel="Cross Color"
			maxHeight={300}
		/>
	);
}
