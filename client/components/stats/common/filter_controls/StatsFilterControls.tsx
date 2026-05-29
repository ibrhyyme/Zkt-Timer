import React from 'react';
import { CaretRight, CaretDown } from 'phosphor-react';
import './StatsFilterControls.scss';
import block from '../../../../styles/bem';
import FancyDropdown, { FancyDropdownOption } from '../../../timer/header_control/FancyDropdown';
import { IDropdownOption } from '../../../common/inputs/dropdown/dropdown_option/DropdownOption';

const b = block('stats-filter-controls');

export interface FilterChip {
	label: string;
	options: IDropdownOption[];
	visible: boolean;
}

interface Props {
	allMode: boolean;
	allLabel: string;
	onAllClick: () => void;
	cubeChip: FilterChip | null;
	subsetChip: FilterChip | null;
	sessionChip: FilterChip | null;
	lastNChip?: FilterChip | null;
}

function ChipDropdown({ chip, active }: { chip: FilterChip; active: boolean }) {
	if (!chip.visible) return null;

	// IDropdownOption (legacy, onClick-based) -> FancyDropdownOption (value-based) conversion.
	// Skip header options — StatsFilterControls uses flat list.
	const fancyOptions: FancyDropdownOption[] = chip.options
		.filter((o) => !o.hidden && !o.header)
		.map((opt, i) => ({
			value: opt.text || `__opt_${i}__`,
			label: opt.text,
			disabled: opt.disabled,
		}));

	const selectedOption = chip.options.find((o) => o.selected);
	const value = selectedOption?.text || '__none__';

	function handleValueChange(newValue: string) {
		const opt = chip.options.find((o) => o.text === newValue);
		if (opt?.onClick) opt.onClick({} as any);
	}

	return (
		<FancyDropdown
			value={value}
			onValueChange={handleValueChange}
			options={fancyOptions}
			noTriggerStyles
			className={b('chip', { active })}
			triggerContent={
				<>
					<span className={b('chip-label')}>{chip.label}</span>
					<CaretDown weight="bold" className={b('chip-caret')} />
				</>
			}
			ariaLabel={chip.label}
			align="start"
			maxHeight={400}
		/>
	);
}

function Separator() {
	return (
		<span className={b('separator')} aria-hidden="true">
			<CaretRight weight="bold" />
		</span>
	);
}

export default function StatsFilterControls(props: Props) {
	const { allMode, allLabel, onAllClick, cubeChip, subsetChip, sessionChip, lastNChip } = props;

	return (
		<div className={b()}>
			<button
				type="button"
				className={b('chip', { active: allMode, all: true })}
				onClick={onAllClick}
			>
				<span className={b('chip-label')}>{allLabel}</span>
			</button>
			{cubeChip?.visible && (
				<>
					<Separator />
					<ChipDropdown chip={cubeChip} active={!allMode} />
				</>
			)}
			{subsetChip?.visible && (
				<>
					<Separator />
					<ChipDropdown chip={subsetChip} active={!allMode} />
				</>
			)}
			{sessionChip?.visible && (
				<>
					<Separator />
					<ChipDropdown chip={sessionChip} active={!allMode} />
				</>
			)}
			{lastNChip?.visible && (
				<>
					<Separator />
					<ChipDropdown chip={lastNChip} active={!allMode} />
				</>
			)}
		</div>
	);
}
