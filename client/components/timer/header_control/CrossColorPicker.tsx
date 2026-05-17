import React from 'react';
import { useTranslation } from 'react-i18next';
import { CaretDown } from 'phosphor-react';
import Dropdown from '../../common/inputs/dropdown/Dropdown';
import { IDropdownOption } from '../../common/inputs/dropdown/dropdown_option/DropdownOption';
import { TopColorFace } from '../../../util/scramble_transform';

interface Props {
	value: TopColorFace | null;
	onChange: (next: TopColorFace) => void;
	mobile?: boolean;
}

const COLOR_OPTIONS: {face: TopColorFace; labelKey: string; color: string}[] = [
	{face: 'U', labelKey: 'face_u', color: '#ffffff'},
	{face: 'D', labelKey: 'face_d', color: '#ffd500'},
	{face: 'R', labelKey: 'face_r', color: '#c41e3a'},
	{face: 'L', labelKey: 'face_l', color: '#ff5800'},
	{face: 'F', labelKey: 'face_f', color: '#009e60'},
	{face: 'B', labelKey: 'face_b', color: '#0051ba'},
];

function ColorSwatch({color}: {color: string}) {
	return (
		<span
			style={{
				display: 'inline-block',
				width: 14,
				height: 14,
				borderRadius: 3,
				background: color,
				border: '1px solid rgba(255,255,255,0.25)',
				verticalAlign: 'middle',
				marginRight: 6,
			}}
		/>
	);
}

export default function CrossColorPicker({value, onChange, mobile}: Props) {
	const {t} = useTranslation();

	const effectiveValue: TopColorFace = value || 'U';
	const current = COLOR_OPTIONS.find((o) => o.face === effectiveValue) || COLOR_OPTIONS[0];

	const options: IDropdownOption[] = COLOR_OPTIONS.map((opt) => ({
		text: t(`trainer.${opt.labelKey}`),
		selected: opt.face === effectiveValue,
		icon: <ColorSwatch color={opt.color} />,
		onClick: () => onChange(opt.face),
	}));

	return (
		<Dropdown
			text={mobile ? undefined : current.face}
			icon={<><ColorSwatch color={current.color} /><CaretDown weight="bold" /></>}
			options={options}
			dropdownMaxHeight={300}
			noMargin
			openLeft
		/>
	);
}
