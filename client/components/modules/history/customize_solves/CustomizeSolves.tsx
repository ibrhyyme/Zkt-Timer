import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { ArrowLeft, ArrowRight, Check, Plus, X } from 'phosphor-react';
import block from '../../../../styles/bem';
import Button from '../../../common/button/Button';
import { closeModal } from '../../../../actions/general';
import { setSetting } from '../../../../db/settings/update';
import { useSettings } from '../../../../util/hooks/useSettings';
import {
	addHistoryColumn,
	DEFAULT_HISTORY_COLUMNS,
	HISTORY_COLUMN_PRESETS,
	historyColumnLabel,
	MAX_HISTORY_COLUMNS,
	moveHistoryColumn,
	parseHistoryColumnInput,
	removeHistoryColumn,
	sanitizeHistoryColumns,
} from '../history_columns';
import './CustomizeSolves.scss';

const b = block('customize-solves');

/**
 * "Customize solves": which rolling averages the solves grid shows next to each time.
 *
 * Every change is saved at once (the grid behind the modal updates live), the same way
 * "Customize stats" works. The list is a platform setting, so it follows the user to
 * every PC (history_columns in db/settings/query.ts).
 */
export default function CustomizeSolves() {
	const { t } = useTranslation();
	const dispatch = useDispatch();
	const stored = useSettings('history_columns');
	const columns = sanitizeHistoryColumns(stored);

	const [custom, setCustom] = useState('');
	const [customError, setCustomError] = useState<string | null>(null);

	const full = columns.length >= MAX_HISTORY_COLUMNS;

	function save(next: number[]) {
		if (next !== columns) setSetting('history_columns', next);
	}

	function togglePreset(n: number) {
		if (columns.includes(n)) save(removeHistoryColumn(columns, columns.indexOf(n)));
		else save(addHistoryColumn(columns, n));
	}

	function addCustom(event?: React.FormEvent) {
		event?.preventDefault();
		const n = parseHistoryColumnInput(custom);
		if (n === null) {
			setCustomError(t('timer_modules.solves_custom_invalid'));
			return;
		}
		if (columns.includes(n)) {
			setCustomError(t('timer_modules.solves_custom_exists', { label: historyColumnLabel(n) }));
			return;
		}
		if (full) {
			setCustomError(t('timer_modules.solves_columns_limit', { max: MAX_HISTORY_COLUMNS }));
			return;
		}
		save(addHistoryColumn(columns, n));
		setCustom('');
		setCustomError(null);
	}

	return (
		<div className={b()}>
			<section className={b('section')}>
				<h3 className={b('heading')}>{t('timer_modules.solves_columns_title')}</h3>
				<div className={b('columns')}>
					{/* The number and the time are always there; shown so the order reads
					    the way the grid does. */}
					<span className={b('chip', { fixed: true })}>#</span>
					<span className={b('chip', { fixed: true })}>{t('timer_modules.solves_col_time')}</span>
					{columns.map((n, index) => (
						<span key={n} className={b('chip')}>
							<button
								type="button"
								className={b('chip-button')}
								disabled={index === 0}
								title={t('timer_modules.solves_move_left')}
								aria-label={t('timer_modules.solves_move_left')}
								onClick={() => save(moveHistoryColumn(columns, index, -1))}
							>
								<ArrowLeft weight="bold" />
							</button>
							<span className={b('chip-label')}>{historyColumnLabel(n)}</span>
							<button
								type="button"
								className={b('chip-button')}
								disabled={index === columns.length - 1}
								title={t('timer_modules.solves_move_right')}
								aria-label={t('timer_modules.solves_move_right')}
								onClick={() => save(moveHistoryColumn(columns, index, 1))}
							>
								<ArrowRight weight="bold" />
							</button>
							<button
								type="button"
								className={b('chip-button', { remove: true })}
								title={t('timer_modules.solves_remove_column')}
								aria-label={t('timer_modules.solves_remove_column')}
								onClick={() => save(removeHistoryColumn(columns, index))}
							>
								<X weight="bold" />
							</button>
						</span>
					))}
				</div>
				{!columns.length && <p className={b('note')}>{t('timer_modules.solves_columns_empty')}</p>}
			</section>

			<section className={b('section')}>
				<h3 className={b('heading')}>{t('timer_modules.solves_presets_title')}</h3>
				<div className={b('presets')}>
					{HISTORY_COLUMN_PRESETS.map((n) => {
						const selected = columns.includes(n);
						return (
							<button
								type="button"
								key={n}
								className={b('preset', { selected })}
								aria-pressed={selected}
								disabled={!selected && full}
								onClick={() => togglePreset(n)}
							>
								{selected ? <Check weight="bold" /> : <Plus weight="bold" />}
								{historyColumnLabel(n)}
							</button>
						);
					})}
				</div>
			</section>

			<section className={b('section')}>
				<h3 className={b('heading')}>{t('timer_modules.solves_custom_title')}</h3>
				<form className={b('custom')} onSubmit={addCustom}>
					<span className={b('custom-prefix')}>ao</span>
					<input
						className={b('custom-input')}
						inputMode="numeric"
						value={custom}
						placeholder={t('timer_modules.solves_custom_placeholder')}
						aria-label={t('timer_modules.solves_custom_title')}
						onChange={(event) => {
							setCustom(event.target.value);
							setCustomError(null);
						}}
					/>
					<Button type="submit" small primary disabled={!custom.trim() || full} text={t('timer_modules.solves_custom_add')} />
				</form>
				<p className={b('note', { error: !!customError })}>
					{customError || (full ? t('timer_modules.solves_columns_limit', { max: MAX_HISTORY_COLUMNS }) : t('timer_modules.count_info'))}
				</p>
			</section>

			<div className={b('footer')}>
				<Button small gray onClick={() => save(DEFAULT_HISTORY_COLUMNS.slice())} text={t('timer_modules.reset_to_defaults')} />
				<Button small primary glow onClick={() => dispatch(closeModal())} text={t('timer_modules.solves_done')} />
			</div>
		</div>
	);
}
