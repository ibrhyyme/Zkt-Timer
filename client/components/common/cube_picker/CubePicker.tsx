import React from 'react';
import FancyDropdown, { FancyDropdownGroup, FancyDropdownOption } from '../../timer/header_control/FancyDropdown';
import { getCubeTypeInfoById } from '../../../util/cubes/util';
import { CubeType } from '../../../util/cubes/cube_types';
import { resourceUri } from '../../../util/storage';
import { useTranslation } from 'react-i18next';
import block from '../../../styles/bem';
import './CubePicker.scss';

const b = block('cube-picker');

interface Props {
	value: string;
	excludeSelected?: boolean;
	handlePrefix?: string;
	cubeTypes?: string[];
	excludeCustomCubeTypes?: boolean;
	onChange?: (cubeType: CubeType) => void;
	excludeOtherCubeType?: boolean;
	// Kept for backwards compatibility — new FancyDropdown uses align/maxHeight props
	dropdownProps?: {
		openLeft?: boolean;
		openUp?: boolean;
		noMargin?: boolean;
		[key: string]: any;
	};
}

// WCA (official events) is the primary entry, kept alone at the top. The rest are
// non-WCA practice buckets, split into 3x3 (methods) and other puzzles.
// Header may be a literal ("3x3") or an i18n key ("cube_picker.*"), translated below.
const CUBE_TYPE_GROUPS: { header: string; types: string[] }[] = [
	{ header: '', types: ['wca'] },
	{ header: '3x3', types: ['333', '333cfop', '333roux', '333mehta'] },
	{
		header: 'cube_picker.other_puzzles',
		types: ['222', '444', '444yau', '555', '666', '777', 'clock', 'minx', 'pyram', 'skewb', 'sq1', 'fto'],
	},
	{ header: '', types: ['other'] },
];

export default function CubePicker(props: Props) {
	const { t } = useTranslation();
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
		// WCA is the primary/official path — emphasize with the WCA logo + a badge.
		if (ct.id === 'wca') {
			return {
				value: ct.id,
				label: ct.name,
				icon: (
					<img
						src={resourceUri('/images/logos/wca_logo.svg')}
						alt=""
						style={{ height: 16, display: 'block' }}
					/>
				),
				badge: <span className={b('wca-badge')}>{t('cube_picker.wca_badge')}</span>,
			};
		}
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

	// WCA cube type — show WCA logo instead of text. Other cube types just show the name (no icon).
	const isWca = cubeType?.id === 'wca';
	const triggerLabel: React.ReactNode = isWca ? (
		<img
			src={resourceUri('/images/logos/wca_logo.svg')}
			alt="WCA"
			style={{ height: 18, display: 'block' }}
		/>
	) : ((handlePrefix || '') + (cubeType?.name || ''));

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
			// Header may be an i18n key (contains a dot) or a literal like "3x3".
			const header = group.header
				? (group.header.includes('.') ? t(group.header) : group.header)
				: undefined;
			return {
				header,
				options: opts,
			};
		})
		.filter((g): g is NonNullable<typeof g> => g !== null);

	return (
		<FancyDropdown
			value={value}
			onValueChange={handleValueChange}
			groups={groups}
			triggerLabel={triggerLabel}
			ariaLabel="Cube Type"
			maxHeight={500}
			triggerMaxWidth={160}
			panelClassName="cube-picker-panel"
		/>
	);
}
