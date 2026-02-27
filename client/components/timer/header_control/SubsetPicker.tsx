import React from 'react';
import { useTranslation } from 'react-i18next';
import { CaretDown, ArrowDown } from 'phosphor-react';
import Dropdown from '../../common/inputs/dropdown/Dropdown';
import { IDropdownOption } from '../../common/inputs/dropdown/dropdown_option/DropdownOption';
import { ScrambleSubset } from '../../../util/cubes/scramble_subsets';

interface Props {
    subsets: ScrambleSubset[];
    selectedSubset?: string | null;
    onChange: (subset: string | null) => void;
    mobile?: boolean;
}

export default function SubsetPicker({ subsets, selectedSubset, onChange, mobile }: Props) {
    const { t } = useTranslation();

    if (!subsets || subsets.length === 0) return null;

    // Find current selection
    const currentSubset = subsets.find(s => s.id === selectedSubset);

    // Translate label: if it's an i18n key (contains dot), translate it; otherwise use as-is
    function translateLabel(label: string): string {
        if (label.includes('.')) {
            return t(label);
        }
        return label;
    }

    // Build options
    const options: IDropdownOption[] = subsets.map(sub => ({
        text: translateLabel(sub.label),
        disabled: sub.id === selectedSubset,
        header: sub.isHeader,
        onClick: () => {
            if (sub.isHeader) return;

            // Handle "None" or valid ID
            const val = sub.id === '' ? null : sub.id;
            onChange(val);
        }
    }));

    const icon = mobile ? <ArrowDown weight="bold" /> : <CaretDown weight="bold" />;
    const text = mobile ? undefined : (currentSubset ? translateLabel(currentSubset.label) : 'WCA');

    return (
        <Dropdown
            text={text}
            icon={icon}
            options={options}
            dropdownMaxHeight={300}
            noMargin
            openLeft
        />
    );
}
