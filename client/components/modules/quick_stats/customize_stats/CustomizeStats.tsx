import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RootStateOrAny, useDispatch, useSelector } from 'react-redux';
import { Check } from 'phosphor-react';
import Button from '../../../common/button/Button';
import Switch, { SwitchFace } from '../../../common/switch/Switch';
import ProTag from '../../../common/pro_tag/ProTag';
import { openProOnlyModal } from '../../../common/pro_only/openProOnlyModal';
import { closeModal } from '../../../../actions/general';
import { setSetting } from '../../../../db/settings/update';
import { useSettings } from '../../../../util/hooks/useSettings';
import { useMe } from '../../../../util/hooks/useMe';
import { StatsModuleBlock } from '../../../../../server/schemas/StatsModule.schema';
import { defaultStatsModuleBlocks } from '../../../../reducers/stats';
import { parseHistoryColumnInput } from '../../history/history_columns';
import {
	DEFAULT_STATS_TABLE_ROWS,
	extraColumnsUnlocked,
	MAX_STATS_TABLE_ROWS,
	resolveTableColumns,
	resolveTableRows,
	sanitizeTableRows,
	STATS_TABLE_COLUMNS,
	STATS_TABLE_SIZES,
	StatsTableColumn,
	tableRowLabel,
} from '../stats_table';
import block from '../../../../styles/bem';
import './CustomizeStats.scss';

const b = block('customize-stats');

/**
 * "Customize stats": two things only. Which averages get a row (one chip each, on or off,
 * plus a size of one's own) and which columns the table shows (a row each, with what it
 * means; the extra ones are Pro). Every change is saved at once and the table behind the
 * modal follows live. The owner found the first version, with presets, a separate row list
 * and a glossary, "aşırı kafa karıştırıcı" (2026-11-23).
 */
export default function CustomizeStats() {
	const { t } = useTranslation();
	const dispatch = useDispatch();
	const me = useMe();
	const storedRows = useSettings('stats_table_rows');
	const storedColumns = useSettings('stats_table_columns');
	const blocks = useSelector((state: RootStateOrAny) => state?.stats?.blocks) as StatsModuleBlock[] | undefined;

	const rows = resolveTableRows(storedRows, blocks, defaultStatsModuleBlocks);
	const columns = resolveTableColumns(storedColumns, blocks);
	const unlocked = extraColumnsUnlocked(me);
	const full = rows.length >= MAX_STATS_TABLE_ROWS;
	// Every ready-made size, plus any size of one's own that is on.
	const chips = sanitizeTableRows([...STATS_TABLE_SIZES, ...rows]);

	const [custom, setCustom] = useState('');
	const [customError, setCustomError] = useState<string | null>(null);

	function saveRows(next: number[]) {
		setSetting('stats_table_rows', sanitizeTableRows(next));
	}

	function toggleRow(n: number) {
		if (rows.includes(n)) {
			saveRows(rows.filter((row) => row !== n));
		} else if (!full) {
			saveRows([...rows, n]);
		}
	}

	function addCustom(event?: React.FormEvent) {
		event?.preventDefault();
		const n = parseHistoryColumnInput(custom);
		if (n === null) {
			setCustomError(t('timer_modules.solves_custom_invalid'));
			return;
		}
		if (rows.includes(n)) {
			setCustomError(t('timer_modules.solves_custom_exists', { label: tableRowLabel(n) }));
			return;
		}
		if (full) {
			setCustomError(t('timer_modules.stats_table_editor.rows_limit', { max: MAX_STATS_TABLE_ROWS }));
			return;
		}
		saveRows([...rows, n]);
		setCustom('');
		setCustomError(null);
	}

	function setColumn(column: StatsTableColumn, on: boolean) {
		const next = on ? [...columns, column] : columns.filter((c) => c !== column);
		setSetting('stats_table_columns', STATS_TABLE_COLUMNS.filter((c) => next.includes(c)));
	}

	function columnRow(column: 'current' | 'best' | StatsTableColumn, fixed: boolean) {
		const name = t(`timer_modules.stats_table.${column}`);
		const help = t(`timer_modules.stats_table_editor.help_${column}`);
		const text = (
			<span className={b('column-text')}>
				<span className={b('column-name')}>
					{name}
					{!fixed && !unlocked && <ProTag />}
				</span>
				<span className={b('column-help')}>{help}</span>
			</span>
		);

		if (fixed) {
			return (
				<li key={column} className={b('column')}>
					{text}
					<span className={b('always')}>{t('timer_modules.stats_table_editor.always')}</span>
				</li>
			);
		}
		const on = columns.includes(column as StatsTableColumn);
		if (!unlocked) {
			// The whole row leads to Pro; the switch shows the column is off.
			return (
				<li key={column}>
					<button
						type="button"
						className={b('column', { locked: true })}
						onClick={() => openProOnlyModal(dispatch, t, 'stats')}
					>
						{text}
						<SwitchFace on={false} disabled />
					</button>
				</li>
			);
		}
		return (
			<li key={column}>
				<label className={b('column', { toggle: true })}>
					{text}
					<Switch on={on} onChange={(value) => setColumn(column as StatsTableColumn, value)} />
				</label>
			</li>
		);
	}

	return (
		<div className={b()}>
			<section className={b('section')}>
				<div className={b('heading-row')}>
					<h3 className={b('heading')}>{t('timer_modules.stats_table_editor.rows_title')}</h3>
					<p className={b('note')}>{t('timer_modules.stats_table_editor.rows_help')}</p>
				</div>
				<div className={b('chips')}>
					{chips.map((n) => {
						const selected = rows.includes(n);
						return (
							<button
								type="button"
								key={n}
								className={b('chip', { selected })}
								aria-pressed={selected}
								disabled={!selected && full}
								onClick={() => toggleRow(n)}
							>
								{selected && <Check weight="bold" />}
								{tableRowLabel(n)}
							</button>
						);
					})}
				</div>
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
					<Button type="submit" small gray disabled={!custom.trim() || full} text={t('timer_modules.solves_custom_add')} />
					{(customError || full) && (
						<span className={b('note', { error: !!customError })}>
							{customError || t('timer_modules.stats_table_editor.rows_limit', { max: MAX_STATS_TABLE_ROWS })}
						</span>
					)}
				</form>
			</section>

			<section className={b('section')}>
				<h3 className={b('heading')}>{t('timer_modules.stats_table_editor.columns_title')}</h3>
				<ul className={b('columns')}>
					{columnRow('current', true)}
					{columnRow('best', true)}
					{STATS_TABLE_COLUMNS.map((column) => columnRow(column, false))}
				</ul>
			</section>

			<div className={b('footer')}>
				<Button
					small
					gray
					onClick={() => {
						saveRows(DEFAULT_STATS_TABLE_ROWS);
						setSetting('stats_table_columns', []);
					}}
					text={t('timer_modules.reset_to_defaults')}
				/>
				<Button small primary onClick={() => dispatch(closeModal())} text={t('timer_modules.solves_done')} />
			</div>
		</div>
	);
}
