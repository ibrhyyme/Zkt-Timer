import React from 'react';
import Dropdown, {DropdownProps} from '../inputs/dropdown/Dropdown';
import {getAllCubeTypeNames, getDefaultCubeTypeNames, getCubeTypeInfoById} from '../../../util/cubes/util';
import {Cube} from 'phosphor-react';
import {IDropdownOption} from '../inputs/dropdown/dropdown_option/DropdownOption';
import {CubeType} from '../../../util/cubes/cube_types';

interface Props {
	value: string;
	excludeSelected?: boolean;
	handlePrefix?: string;
	cubeTypes?: string[];
	excludeCustomCubeTypes?: boolean;
	onChange?: (cubeType: CubeType) => void;
	excludeOtherCubeType?: boolean;
	dropdownProps?: Partial<DropdownProps>;
}

// BL/FM/OH/MBLD/Mirror/Yau variant'lari artik parent cube'un subset'i — burada tek grup
const CUBE_TYPE_GROUPS: { header: string; types: string[] }[] = [
	{ header: '', types: ['wca'] },
	{
		header: 'WCA',
		types: [
			'333', '333cfop', '333roux', '333mehta', '333zz', '333sub',
			'222',
			'444', '444yau',
			'555', '666', '777',
			'clock', 'minx', 'pyram', 'skewb', 'sq1',
		],
	},
	{ header: '', types: ['other'] },
];

export default function CubePicker(props: Props) {
	const {
		value,
		cubeTypes,
		handlePrefix,
		excludeCustomCubeTypes,
		excludeSelected,
		onChange,
		dropdownProps,
		excludeOtherCubeType,
	} = props;

	const options: IDropdownOption[] = [];

	if (cubeTypes) {
		// Custom list — flat
		for (const name of cubeTypes) {
			const ct = getCubeTypeInfoById(name);
			const isSelected = ct?.id === value;
			if (!name || !ct || (excludeOtherCubeType && name === 'other') || (excludeSelected && isSelected)) continue;
			options.push({ text: ct.name, selected: isSelected, onClick: () => onChange && onChange(ct) });
		}
	} else {
		// Default — cstimer style grouped with headers
		for (const group of CUBE_TYPE_GROUPS) {
			if (group.header) {
				options.push({ text: group.header, header: true });
			}
			for (const name of group.types) {
				const ct = getCubeTypeInfoById(name);
				const isSelected = ct?.id === value;
				if (!ct || (excludeOtherCubeType && name === 'other') || (excludeSelected && isSelected)) continue;
				options.push({ text: ct.name, selected: isSelected, onClick: () => onChange && onChange(ct) });
			}
		}
	}

	const cubeType = getCubeTypeInfoById(value);

	let text = handlePrefix || '';
	text += cubeType?.name || '';

	return (
		<Dropdown
			text={text}
			icon={<Cube weight="bold" />}
			options={options}
			dropdownMaxHeight={400}
			{...(dropdownProps || {})}
		/>
	);
}
