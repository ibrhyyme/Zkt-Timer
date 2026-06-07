import React from 'react';
import { useTranslation } from 'react-i18next';
import FancyDropdown, { FancyDropdownGroup } from './FancyDropdown';
import { ScrambleSubset } from '../../../util/cubes/scramble_subsets';

interface Props {
	subsets: ScrambleSubset[];
	selectedSubset?: string | null;
	onChange: (subset: string | null) => void;
	mobile?: boolean;
	// Cube type id — kept for caller compatibility. No longer used for display:
	// the active subset label is now shown inline for ALL cube types.
	cubeTypeId?: string;
}

// Radix Select doesn't allow empty string value — use virtual value for null/'' subset
const NONE_VALUE = '__default__';

function toFancyValue(subset: string | null): string {
	return subset === null || subset === '' ? NONE_VALUE : subset;
}

function fromFancyValue(value: string): string | null {
	return value === NONE_VALUE ? null : value;
}

export default function SubsetPicker({ subsets, selectedSubset, onChange }: Props) {
	const { t } = useTranslation();

	if (!subsets || subsets.length === 0) return null;

	const effectiveSelected = selectedSubset ?? '';

	function translateLabel(label: string): string {
		if (label.includes('.')) {
			return t(label);
		}
		return label;
	}

	// isHeader=true → start new group; isHeader=false → add to previous group
	const groups: FancyDropdownGroup[] = [];
	let currentGroup: FancyDropdownGroup | null = null;

	for (const sub of subsets) {
		if (sub.isHeader) {
			currentGroup = { header: translateLabel(sub.label), options: [] };
			groups.push(currentGroup);
		} else {
			if (!currentGroup) {
				// Headerless start (like default subset)
				currentGroup = { options: [] };
				groups.push(currentGroup);
			}
			currentGroup.options.push({
				value: toFancyValue(sub.id),
				label: translateLabel(sub.label),
			});
		}
	}

	const firstNonHeader = subsets.find(s => !s.isHeader);
	const currentSubset = subsets.find(s => !s.isHeader && s.id === effectiveSelected);
	const displaySubset = currentSubset || firstNonHeader;
	// Always show the active subset inline — it is the primary info on method cube
	// types (e.g. CFOP → PLL), not just WCA. Width is capped in the timer header via
	// the `subset-picker-trigger` class (HeaderControl.scss); page contexts (Sessions,
	// Solves) have room and show the full label.
	const triggerLabel = displaySubset ? translateLabel(displaySubset.label) : undefined;

	function handleValueChange(value: string) {
		onChange(fromFancyValue(value));
	}

	return (
		<FancyDropdown
			value={toFancyValue(effectiveSelected)}
			onValueChange={handleValueChange}
			groups={groups}
			triggerLabel={triggerLabel}
			ariaLabel="Scramble Subset"
			maxHeight={400}
			className="subset-picker-trigger"
		/>
	);
}
