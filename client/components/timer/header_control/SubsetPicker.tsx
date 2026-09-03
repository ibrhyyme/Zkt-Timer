import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'phosphor-react';
import FancyDropdown, { FancyDropdownGroup } from './FancyDropdown';
import { ScrambleSubset } from '../../../util/cubes/scramble_subsets';
import { TopColorFace } from '../../../util/scramble_transform';

interface Props {
	subsets: ScrambleSubset[];
	selectedSubset?: string | null;
	onChange: (subset: string | null) => void;
	mobile?: boolean;
	// Cube type id — kept for caller compatibility. No longer used for display:
	// the active subset label is now shown inline for ALL cube types.
	cubeTypeId?: string;
	// Top-layer colour, folded into this menu rather than standing as its own
	// control. It only exists for 3x3 CFOP's PLL/OLL/f2l subsets, so on a narrow
	// phone it appeared exactly when the header row was already out of room and ate
	// the last 40px. Both props must be supplied for the group to render — the
	// Sessions, Solves and import-review pickers pass neither and are unaffected.
	topColor?: TopColorFace | null;
	onTopColorChange?: (face: TopColorFace) => void;
}

// Radix Select doesn't allow empty string value — use virtual value for null/'' subset
const NONE_VALUE = '__default__';

// Virtual-value prefix, the same trick SessionPicker uses for "New session"
// (see FancyDropdown's header comment). Radix Select carries one value and that
// value is the subset, so colour rows travel back through onValueChange tagged
// like this and are peeled off before the subset handler ever sees them.
const COLOR_PREFIX = '__color__';

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

function toFancyValue(subset: string | null): string {
	return subset === null || subset === '' ? NONE_VALUE : subset;
}

function fromFancyValue(value: string): string | null {
	return value === NONE_VALUE ? null : value;
}

export default function SubsetPicker({ subsets, selectedSubset, onChange, topColor, onTopColorChange }: Props) {
	const { t } = useTranslation();

	if (!subsets || subsets.length === 0) return null;

	const showTopColor = !!onTopColorChange;
	const effectiveTopColor: TopColorFace = topColor || 'U';

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

	if (showTopColor) {
		groups.push({
			header: t('scramble_subsets.top_color'),
			options: COLOR_OPTIONS.map((opt) => ({
				value: `${COLOR_PREFIX}${opt.face}`,
				label: t(`trainer.${opt.labelKey}`),
				icon: <ColorSwatch color={opt.color} />,
				// Radix reserves its own tick for the item matching the Select's value,
				// which here is always a subset. These rows can never be "checked", so
				// the active colour is marked in the badge slot instead.
				badge: opt.face === effectiveTopColor ? <Check weight="bold" size={16} /> : undefined,
			})),
		});
	}

	const firstNonHeader = subsets.find(s => !s.isHeader);
	const currentSubset = subsets.find(s => !s.isHeader && s.id === effectiveSelected);
	const displaySubset = currentSubset || firstNonHeader;
	// Always show the active subset inline — it is the primary info on method cube
	// types (e.g. CFOP → PLL), not just WCA. Width is capped in the timer header via
	// the `subset-picker-trigger` class (HeaderControl.scss); page contexts (Sessions,
	// Solves) have room and show the full label.
	const triggerLabel = displaySubset ? translateLabel(displaySubset.label) : undefined;

	// No colour swatch on the trigger, deliberately. Three placements were measured and
	// each one cost more than it was worth: after the text it was clipped away entirely
	// at 320px, in the icon slot it took 20px from the label at every width, and before
	// the text it survived but chopped "PLL" to "PLl" at 360px. The subset name is the
	// primary information here and this row is short of space to begin with — that is
	// the whole reason the colour control moved into the menu. The active colour is
	// shown there, ticked.

	function handleValueChange(value: string) {
		if (value.startsWith(COLOR_PREFIX)) {
			onTopColorChange?.(value.slice(COLOR_PREFIX.length) as TopColorFace);
			return;
		}
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
