import React from 'react';
import { Cube } from 'phosphor-react';
import FancyDropdown, { FancyDropdownGroup, FancyDropdownOption } from '../../timer/header_control/FancyDropdown';
import { getCubeTypeInfoById } from '../../../util/cubes/util';
import { CubeType } from '../../../util/cubes/cube_types';

interface Props {
	value: string;
	excludeSelected?: boolean;
	handlePrefix?: string;
	cubeTypes?: string[];
	excludeCustomCubeTypes?: boolean;
	onChange?: (cubeType: CubeType) => void;
	excludeOtherCubeType?: boolean;
	// Geriye uyumluluk icin tutuluyor — yeni FancyDropdown align/maxHeight prop'larini kullanir
	dropdownProps?: {
		openLeft?: boolean;
		openUp?: boolean;
		noMargin?: boolean;
		[key: string]: any;
	};
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
		excludeSelected,
		onChange,
		excludeOtherCubeType,
	} = props;

	function makeOption(name: string): FancyDropdownOption | null {
		const ct = getCubeTypeInfoById(name);
		if (!ct) return null;
		if (excludeOtherCubeType && name === 'other') return null;
		if (excludeSelected && ct.id === value) return null;
		return {
			value: ct.id,
			label: ct.name,
		};
	}

	const cubeType = getCubeTypeInfoById(value);

	function handleValueChange(newValue: string) {
		const ct = getCubeTypeInfoById(newValue);
		if (ct && onChange) onChange(ct);
	}

	// WCA cube type — text yerine WCA logosu. Cube ikon da gizlenir cunku logo zaten ayirt edici.
	const isWca = cubeType?.id === 'wca';
	const triggerLabel: React.ReactNode = isWca ? (
		<img
			src="/images/logos/wca_logo.svg"
			alt="WCA"
			style={{ height: 18, display: 'block' }}
		/>
	) : ((handlePrefix || '') + (cubeType?.name || ''));
	const triggerIcon = isWca ? undefined : <Cube weight="bold" size={16} />;

	// Flat list (custom cubeTypes) vs grouped (default)
	if (cubeTypes) {
		const options = cubeTypes
			.map(makeOption)
			.filter((o): o is FancyDropdownOption => !!o);

		return (
			<FancyDropdown
				value={value}
				onValueChange={handleValueChange}
				options={options}
				triggerIcon={triggerIcon}
				triggerLabel={triggerLabel}
				ariaLabel="Cube Type"
				triggerMaxWidth={160}
			/>
		);
	}

	const groups: FancyDropdownGroup[] = CUBE_TYPE_GROUPS
		.map((group) => {
			const opts = group.types
				.map(makeOption)
				.filter((o): o is FancyDropdownOption => !!o);
			if (opts.length === 0) return null;
			return {
				header: group.header || undefined,
				options: opts,
			};
		})
		.filter((g): g is NonNullable<typeof g> => g !== null);

	return (
		<FancyDropdown
			value={value}
			onValueChange={handleValueChange}
			groups={groups}
			triggerIcon={triggerIcon}
			triggerLabel={triggerLabel}
			ariaLabel="Cube Type"
			maxHeight={500}
			triggerMaxWidth={160}
		/>
	);
}
