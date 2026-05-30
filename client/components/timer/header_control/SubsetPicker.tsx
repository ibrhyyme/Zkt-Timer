import React from 'react';
import { useTranslation } from 'react-i18next';
import FancyDropdown, { FancyDropdownGroup } from './FancyDropdown';
import { ScrambleSubset } from '../../../util/cubes/scramble_subsets';

interface Props {
	subsets: ScrambleSubset[];
	selectedSubset?: string | null;
	onChange: (subset: string | null) => void;
	mobile?: boolean;
	// Cube type id — only WCA shows the subset name inline.
	// Other cube types (3x3 CFOP, 4x4 Yau/Hoya, etc) keep the trigger compact
	// (just the down arrow) to save header space on mobile.
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

export default function SubsetPicker({ subsets, selectedSubset, onChange, cubeTypeId }: Props) {
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
	// Only WCA shows the subset name inline; other cube types keep trigger compact (caret only).
	const showInlineLabel = cubeTypeId === 'wca';
	const triggerLabel = showInlineLabel && displaySubset ? translateLabel(displaySubset.label) : undefined;

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
			triggerMinWidth={showInlineLabel ? undefined : 40}
		/>
	);
}
