import React from 'react';
import { useTranslation } from 'react-i18next';
import FancyDropdown, { FancyDropdownGroup } from './FancyDropdown';
import { ScrambleSubset } from '../../../util/cubes/scramble_subsets';

interface Props {
	subsets: ScrambleSubset[];
	selectedSubset?: string | null;
	onChange: (subset: string | null) => void;
	mobile?: boolean;
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
	const triggerLabel = displaySubset ? translateLabel(displaySubset.label) : '';

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
		/>
	);
}
