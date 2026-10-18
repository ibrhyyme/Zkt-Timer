import React, { ReactNode, useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useTranslation } from 'react-i18next';
import { CaretDown, Check, MagnifyingGlass } from 'phosphor-react';
import './CubeFilterPicker.scss';
import block from '../../../styles/bem';
import useExclusiveDropdown from '../../../util/hooks/useExclusiveDropdown';
import {
	countCubeFilterChoices,
	CUBE_FILTER_SEARCH_THRESHOLD,
	CubeFilterGroup,
	searchCubeFilterGroups,
} from './cube_filter_options';

const b = block('cube-filter-picker');

interface Props {
	groups: CubeFilterGroup[];
	/** Selected cube id; null is "Tüm küpler". */
	value: string | null;
	/** Name of the selected cube (it may be one the list does not offer, e.g. from a link). */
	valueName: string | null;
	onChange: (cubeId: string | null) => void;
	/** Trigger classes. Defaults to the picker's own button look (Solves toolbar). */
	triggerClassName?: string;
	labelClassName?: string;
	caretClassName?: string;
	align?: 'start' | 'end' | 'center';
}

/**
 * The Cube filter dropdown (design magnet-cubes 8.2), shared by the Solves toolbar and the Stats
 * chip row. A popover, not a Select: past CUBE_FILTER_SEARCH_THRESHOLD cubes it carries a search
 * box, and a text field inside a Radix Select fights its typeahead and focus handling.
 */
export default function CubeFilterPicker(props: Props) {
	const { groups, value, valueName, onChange, triggerClassName, labelClassName, caretClassName, align = 'start' } = props;
	const { t } = useTranslation();
	const [open, setOpen] = useExclusiveDropdown();
	const [query, setQuery] = useState('');

	// A fresh list on every opening
	useEffect(() => {
		if (!open) setQuery('');
	}, [open]);

	// Same as the other pickers: a starting timer closes it
	useEffect(() => {
		if (!open) return;
		const close = () => setOpen(false);
		window.addEventListener('timerInteractionStart', close);
		return () => window.removeEventListener('timerInteractionStart', close);
	}, [open]);

	const searchable = countCubeFilterChoices(groups) > CUBE_FILTER_SEARCH_THRESHOLD;
	const shown = searchable ? searchCubeFilterGroups(groups, query) : groups;

	function choose(id: string | null) {
		setOpen(false);
		if (id !== value) onChange(id);
	}

	const label = t('cube_filter.chip', { name: value ? valueName || t('cube_filter.all') : t('cube_filter.all') });

	function renderRow(id: string | null, text: ReactNode, key: string, badge?: ReactNode) {
		const selected = id === value;
		return (
			<button
				key={key}
				type="button"
				role="menuitemradio"
				aria-checked={selected}
				className={b('option', { selected })}
				onClick={() => choose(id)}
			>
				<span className={b('option-label')}>{text}</span>
				{badge}
				{selected && <Check weight="bold" size={14} className={b('check')} />}
			</button>
		);
	}

	return (
		<Popover.Root open={open} onOpenChange={setOpen}>
			<Popover.Trigger asChild>
				<button
					type="button"
					className={triggerClassName || b('trigger', { active: !!value })}
					aria-label={t('cube_filter.aria')}
				>
					<span className={labelClassName || b('trigger-label')}>{label}</span>
					<CaretDown weight="bold" className={caretClassName || b('trigger-caret')} />
				</button>
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content className={b('panel')} align={align} sideOffset={6} collisionPadding={12}>
					{searchable && (
						<label className={b('search')}>
							<MagnifyingGlass weight="bold" className={b('search-icon')} />
							<input
								type="search"
								className={b('search-input')}
								value={query}
								placeholder={t('cubes.search_placeholder')}
								aria-label={t('cubes.search_placeholder')}
								onChange={(e) => setQuery(e.target.value)}
							/>
						</label>
					)}
					<div className={b('list')} role="menu" aria-label={t('cube_filter.aria')}>
						{renderRow(null, t('cube_filter.all'), '__all__')}
						{shown.map((group) => (
							<div key={group.key} className={b('group', { archived: group.archived })} role="group" aria-label={group.header || undefined}>
								{group.header && <div className={b('group-label')}>{group.header}</div>}
								{group.choices.map((choice) =>
									renderRow(
										choice.id,
										choice.name,
										choice.id,
										choice.isMain ? <span className={b('badge')}>{t('cubes.badge_main')}</span> : null
									)
								)}
							</div>
						))}
						{searchable && query.trim() && !shown.length && <div className={b('empty')}>{t('cubes.no_match')}</div>}
					</div>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}
