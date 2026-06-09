import React, {useState} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {toastSuccess, toastError} from '../../../../util/toast';
import {b} from '../shared';
import {Plus, Trash, FilePdf} from 'phosphor-react';
import {
	buildScheduleRows,
	groupRowsByDay,
	formatRowTime,
} from '../../../community/zkt_competitions/scheduleUtils';
import {generateSchedulePdf} from '../../../../util/cubes/schedule_pdf';

const CREATE_ITEM = gql`
	mutation CreateZktScheduleItem($input: CreateZktScheduleItemInput!) {
		createZktScheduleItem(input: $input) {
			id
		}
	}
`;

const DELETE_ITEM = gql`
	mutation DeleteZktScheduleItem($itemId: String!) {
		deleteZktScheduleItem(itemId: $itemId)
	}
`;

export default function DashboardSchedule({
	detail,
	onUpdated,
}: {
	detail: any;
	onUpdated: () => void;
}) {
	const {t, i18n} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const locale = i18n.language === 'tr' ? 'tr-TR' : i18n.language;

	const [title, setTitle] = useState('');
	const [startTime, setStartTime] = useState('');
	const [endTime, setEndTime] = useState('');
	const [saving, setSaving] = useState(false);

	const rows = buildScheduleRows(detail, (n) => t('round_n', {n}));
	const days = groupRowsByDay(rows, locale);
	const customIds = new Set((detail.schedule_items || []).map((s: any) => s.id));

	async function addItem() {
		if (!title.trim() || !startTime) {
			toastError(t('fill_required'));
			return;
		}
		setSaving(true);
		try {
			await gqlMutate(CREATE_ITEM, {
				input: {
					competitionId: detail.id,
					title: title.trim(),
					startTime,
					endTime: endTime || null,
				},
			});
			toastSuccess(t('schedule_item_added'));
			setTitle('');
			setStartTime('');
			setEndTime('');
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		} finally {
			setSaving(false);
		}
	}

	async function removeItem(itemId: string) {
		try {
			await gqlMutate(DELETE_ITEM, {itemId});
			toastSuccess(t('schedule_item_deleted'));
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function downloadPdf() {
		await generateSchedulePdf({
			competitionName: detail.name,
			subtitle: detail.location || undefined,
			heading: t('tab_schedule'),
			days: days.map(({day, rows: dayRows}) => ({
				day: day || t('schedule_untimed'),
				rows: dayRows.map((row) => ({
					time: formatRowTime(row, locale),
					title: row.title,
				})),
			})),
		});
	}

	return (
		<div className={b('schedule-manager')}>
			{/* Add custom activity (lunch, opening, awards...) */}
			<div className={b('sub-section')}>
				<div className={b('sub-section-title')}>{t('schedule_add_custom')}</div>
				<div className={b('field-row')}>
					<div className={b('field')}>
						<label className={b('label')}>{t('schedule_item_title')}</label>
						<input
							className={b('input')}
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder={t('schedule_item_placeholder')}
						/>
					</div>
					<div className={b('field')}>
						<label className={b('label')}>{t('schedule_start')}</label>
						<input
							type="datetime-local"
							className={b('input')}
							value={startTime}
							onChange={(e) => setStartTime(e.target.value)}
						/>
					</div>
					<div className={b('field')}>
						<label className={b('label')}>{t('schedule_end')}</label>
						<input
							type="datetime-local"
							className={b('input')}
							value={endTime}
							onChange={(e) => setEndTime(e.target.value)}
						/>
					</div>
				</div>
				<div>
					<button
						type="button"
						className={b('action-btn', {primary: true})}
						onClick={addItem}
						disabled={saving}
					>
						<Plus weight="bold" /> {t('schedule_add')}
					</button>
					<button
						type="button"
						className={b('action-btn')}
						style={{marginLeft: '0.5rem'}}
						onClick={downloadPdf}
						disabled={rows.length === 0}
					>
						<FilePdf weight="bold" /> {t('schedule_pdf')}
					</button>
				</div>
				<div className={b('field-hint')}>{t('schedule_hint')}</div>
			</div>

			{/* Combined timeline (round rows derived from group times, read-only) */}
			<div className={b('sub-section')}>
				<div className={b('sub-section-title')}>{t('tab_schedule')}</div>
				{rows.length === 0 ? (
					<div className={b('empty')}>{t('no_schedule_yet')}</div>
				) : (
					days.map(({day, rows: dayRows}) => (
						<div key={day || 'untimed'} className={b('schedule-day-block')}>
							<div className={b('schedule-day-heading')}>
								{day || t('schedule_untimed')}
							</div>
							{dayRows.map((row) => (
								<div key={row.id} className={b('schedule-row', {round: row.isRound})}>
									<span className={b('schedule-row-time')}>
										{formatRowTime(row, locale) || '—'}
									</span>
									<span className={b('schedule-row-title')}>
										{row.eventId && (
											<span
												className={`cubing-icon event-${row.eventId}`}
												style={{marginRight: 6}}
											/>
										)}
										{row.title}
									</span>
									{customIds.has(row.id) && (
										<button
											type="button"
											className={b('action-btn', {danger: true})}
											onClick={() => removeItem(row.id)}
											title={t('delete')}
										>
											<Trash weight="bold" />
										</button>
									)}
								</div>
							))}
						</div>
					))
				)}
			</div>
		</div>
	);
}
