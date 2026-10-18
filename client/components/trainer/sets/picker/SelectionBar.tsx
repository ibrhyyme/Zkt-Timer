/**
 * The picker's bottom bar and its selection list (trainer-sets 5.5).
 *
 * The bar sits above the safe area and, with the keyboard open, above the keyboard (the picker
 * root writes --keyboard-h). Tapping the count opens the list of picked cases grouped by
 * category, where a row can be taken out again. "Add" is off while offline.
 */
import React from 'react';
import {useTranslation} from 'react-i18next';
import {CaretDown, CaretUp, Plus, WifiSlash, X} from 'phosphor-react';
import block from '../../../../styles/bem';
import Button from '../../../common/button/Button';
import {groupSelection, type PickerSelectionItem} from './picker_model';

const b = block('set-picker');

interface SelectionPanelProps {
	items: PickerSelectionItem[];
	onRemove: (key: string) => void;
	onClose: () => void;
}

export function SelectionPanel({items, onRemove, onClose}: SelectionPanelProps) {
	const {t} = useTranslation();
	const groups = groupSelection(items);
	return (
		<section className={b('panel')} aria-label={t('trainer.sets.picker.selected_title')}>
			<header className={b('panel-head')}>
				<h3 className={b('panel-title')}>{t('trainer.sets.picker.selected_title')}</h3>
				<button type="button" className={b('icon-btn')} onClick={onClose} aria-label={t('trainer.sets.dismiss')}>
					<X size={18} weight="bold" aria-hidden="true" />
				</button>
			</header>
			<div className={b('panel-body')}>
				{groups.map((group) => (
					<div key={group.category} className={b('panel-group')}>
						<h4 className={b('panel-group-title')}>{group.category}</h4>
						<ul className={b('panel-rows')}>
							{group.items.map((item) => (
								<li key={item.key} className={b('panel-row')}>
									<span className={b('panel-row-body')}>
										<span className={b('panel-row-name')}>{item.case_name}</span>
										<code className={b('panel-row-alg')}>{item.algorithm}</code>
									</span>
									<button
										type="button"
										className={b('icon-btn')}
										onClick={() => onRemove(item.key)}
										aria-label={`${item.case_name}: ${t('trainer.sets.picker.remove')}`}
										title={t('trainer.sets.picker.remove')}
									>
										<X size={16} weight="bold" aria-hidden="true" />
									</button>
								</li>
							))}
						</ul>
					</div>
				))}
			</div>
		</section>
	);
}

interface SelectionBarProps {
	items: PickerSelectionItem[];
	panelOpen: boolean;
	onTogglePanel: () => void;
	onClear: () => void;
	onAdd: () => void;
	adding: boolean;
	online: boolean;
	/** The user tried to pick past the 500 row limit. */
	limitHit: boolean;
	/** Show the picked names next to the count (desktop). */
	wide: boolean;
}

export function SelectionBar({items, panelOpen, onTogglePanel, onClear, onAdd, adding, online, limitHit, wide}: SelectionBarProps) {
	const {t} = useTranslation();
	const count = items.length;
	const note = !online ? t('trainer.sets.offline_needed') : limitHit ? t('trainer.sets.limit_items') : null;

	return (
		<div className={b('bar')}>
			{note ? (
				<p className={b('bar-note', {warning: limitHit && online})} role="status">
					{!online ? <WifiSlash size={16} aria-hidden="true" /> : null}
					{note}
				</p>
			) : null}
			<div className={b('bar-row')}>
				<button
					type="button"
					className={b('bar-count')}
					onClick={onTogglePanel}
					disabled={count === 0}
					aria-expanded={panelOpen}
				>
					<span className={b('bar-count-text')}>{t('trainer.sets.selected_count', {count})}</span>
					{wide && count > 0 ? (
						<span className={b('bar-names')}>{items.map((item) => item.case_name).join(', ')}</span>
					) : null}
					{count > 0 ? (panelOpen ? <CaretDown size={16} aria-hidden="true" /> : <CaretUp size={16} aria-hidden="true" />) : null}
				</button>
				{wide && count > 0 ? (
					<Button gray text={t('trainer.sets.picker.clear')} onClick={onClear} disabled={adding} />
				) : null}
				<Button
					primary
					icon={<Plus weight="bold" />}
					iconFirst
					text={t('trainer.sets.picker.add')}
					onClick={onAdd}
					loading={adding}
					disabled={count === 0 || !online || adding}
					title={!online ? t('trainer.sets.offline_needed') : undefined}
				/>
			</div>
		</div>
	);
}
