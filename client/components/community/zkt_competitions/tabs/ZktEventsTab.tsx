import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory, useParams} from 'react-router-dom';
import {b, getEventName, formatCs, formatName, formatTimeRange} from '../shared';

export default function ZktEventsTab({detail}: {detail: any}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const [expandedRound, setExpandedRound] = useState<string | null>(null);

	// Each round of every event in one row. Event name only on first round
	// (WCA EventsTab pattern — for easy scanning).
	const rows = useMemo(() => {
		const out: any[] = [];
		for (const ev of detail.events) {
			// Day first: a SEPARATE day-split event has one chain per day, so two
			// "round 1"s, and a flat sort interleaves them.
			const sorted = [...(ev.rounds || [])].sort(
				(a: any, bx: any) =>
					(a.dayIndex || 0) - (bx.dayIndex || 0) || a.roundNumber - bx.roundNumber
			);
			sorted.forEach((r: any, i: number) => {
				out.push({
					roundId: r.roundId,
					eventId: ev.eventId,
					eventName: getEventName(ev.eventId),
					roundNumber: r.roundNumber,
					format: r.format,
					timeLimitCs: r.timeLimitCs,
					cutoffCs: r.cutoffCs,
					cutoffAttempts: r.cutoffAttempts,
					advancementType: r.advancementType,
					advancementLevel: r.advancementLevel,
					status: r.status,
					groups: r.groups || [],
					isFirstRound: i === 0,
					isFinal: !!r.isFinal,
					dayLabel: r.dayLabel || null,
					roundKey: `${ev.eventId}-r${r.roundNumber}-d${r.dayIndex || 0}`,
				});
			});
		}
		return out;
	}, [detail.events]);

	if (detail.events.length === 0) {
		return <div className={b('empty')}>{t('no_events')}</div>;
	}

	return (
		<div className={b('events-tab')}>
			<div className={b('events-table-wrapper')}>
				<table className={b('events-table')}>
					<thead>
						<tr>
							<th>{t('col_event')}</th>
							<th>{t('col_round')}</th>
							<th>{t('col_format')}</th>
							<th>{t('col_groups')}</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row: any) => (
							<React.Fragment key={row.roundKey}>
								<tr
									className={b('events-row', {active: expandedRound === row.roundKey})}
									onClick={() =>
										setExpandedRound(expandedRound === row.roundKey ? null : row.roundKey)
									}
								>
									<td className={b('events-cell-event')}>
										{row.isFirstRound ? (
											<span>
												<span
													className={`cubing-icon event-${row.eventId}`}
													style={{fontSize: 20, marginRight: 8, verticalAlign: 'middle'}}
												/>
												{row.eventName}
											</span>
										) : ''}
									</td>
									<td className={b('events-cell-center')}>
										{row.isFinal ? t('round_final') : row.roundNumber}
										{row.dayLabel ? ` · ${row.dayLabel}` : ''}
									</td>
									<td className={b('events-cell-center')}>{formatName(row.format)}</td>
									<td className={b('events-cell-center')}>{row.groups.length}</td>
									<td className={b('events-cell-view')}>
										<span className={b('round-status-pill', {[row.status.toLowerCase()]: true})}>
											{t(`round_status_${row.status.toLowerCase()}`)}
										</span>
									</td>
								</tr>
								{expandedRound === row.roundKey && (
									<tr className={b('events-expanded-row')}>
										<td colSpan={5}>
											<RoundPanel row={row} />
										</td>
									</tr>
								)}
							</React.Fragment>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function RoundPanel({row}: {row: any}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();
	const {competitionId} = useParams<{competitionId: string}>();

	const infoChips: string[] = [];
	if (row.timeLimitCs) {
		infoChips.push(`${t('time_limit_short')}: ${formatCs(row.timeLimitCs)}`);
	}
	if (row.cutoffCs) {
		const attempts = row.cutoffAttempts ? ` / ${row.cutoffAttempts}` : '';
		infoChips.push(`${t('cutoff_short')}: ${formatCs(row.cutoffCs)}${attempts}`);
	}
	if (row.advancementType && row.advancementLevel) {
		infoChips.push(
			row.advancementType === 'PERCENT'
				? `${t('advancement_short')}: ${row.advancementLevel}%`
				: `${t('advancement_short')}: Top ${row.advancementLevel}`
		);
	}

	return (
		<div className={b('round-panel')}>
			{infoChips.length > 0 && (
				<div className={b('round-info')}>
					{infoChips.map((c) => (
						<span key={c} className={b('round-info-item')}>
							{c}
						</span>
					))}
				</div>
			)}

			{row.groups.length === 0 ? (
				<div className={b('round-panel-empty')}>{t('no_groups_in_round')}</div>
			) : (
				<div className={b('group-cards')}>
					{[...row.groups]
						.sort((a: any, bx: any) => a.groupNumber - bx.groupNumber)
						.map((g: any) => (
							<button
								key={g.groupId}
								type="button"
								className={b('group-card')}
								onClick={() =>
									history.push(
										`/zkt-competitions/${competitionId}/activities/${g.groupId}`
									)
								}
							>
								<span className={b('group-card-title')}>
									{t('col_group')} {g.groupNumber}
								</span>
								{g.startTime && (
									<span className={b('group-card-time')}>
										{formatTimeRange(g.startTime, g.endTime)}
									</span>
								)}
							</button>
						))}
				</div>
			)}
		</div>
	);
}
