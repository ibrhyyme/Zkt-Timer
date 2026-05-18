import React from 'react';
import {CaretRight, CaretDown} from 'phosphor-react';
import './StatsFilterControls.scss';
import block from '../../../../styles/bem';
import Dropdown from '../../../common/inputs/dropdown/Dropdown';
import {IDropdownOption} from '../../../common/inputs/dropdown/dropdown_option/DropdownOption';

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

function ChipDropdown({chip, active}: {chip: FilterChip; active: boolean}) {
	if (!chip.visible) return null;
	// openLeft KASTEN yok: default `right: 0` davranisi ile dropdown chip'in altinda
	// saga hizali acilir (sola dogru sarkar), bu sayede en sondaki session chip mobilde
	// ekran disina tasmaz.
	return (
		<Dropdown
			options={chip.options}
			handle={
				<span className={b('chip', {active})}>
					<span className={b('chip-label')}>{chip.label}</span>
					<CaretDown weight="bold" className={b('chip-caret')} />
				</span>
			}
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
	const {allMode, allLabel, onAllClick, cubeChip, subsetChip, sessionChip, lastNChip} = props;

	return (
		<div className={b()}>
			<button
				type="button"
				className={b('chip', {active: allMode, all: true})}
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
