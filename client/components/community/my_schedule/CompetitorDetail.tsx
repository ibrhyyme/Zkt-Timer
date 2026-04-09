import React, {useEffect, useState, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {ArrowLeft, CalendarBlank, Users, Info, Warning} from 'phosphor-react';
import {useCompetitionData} from './CompetitionLoader';
import {openInAppBrowser} from '../../../util/external-link';
import {
	b, I18N_LOCALE_MAP, ROLE_COLORS, formatTime, formatDayHeader, getRoleLabel,
	EventIcon, countryFlag,
} from './shared';
import {useNow} from '../../../util/hooks/useNow';

interface CompetitorDetailProps {
	registrantId: number;
}

export default function CompetitorDetail({registrantId}: CompetitorDetailProps) {
	const {t, i18n} = useTranslation();
	const history = useHistory();
	const {detail} = useCompetitionData();
	const locale = I18N_LOCALE_MAP[i18n.language] || i18n.language;

	const selected = useMemo(() => {
		return detail?.competitors?.find((c: any) => c.registrantId === registrantId) || null;
	}, [detail, registrantId]);

	if (!selected) {
		return (
			<div className={b('info-banner')}>
				<Info size={20} />
				<span>{t('my_schedule.competitor_not_found')}</span>
			</div>
		);
	}

	const wcaLiveCompId = detail.wcaLiveCompId;
	const wcaLiveCompetitors = detail.wcaLiveCompetitors || [];

	return (
		<div className={b('competitor-detail')}>
			<button className={b('back-sm')} onClick={() => history.goBack()}>
				<ArrowLeft size={16} />
				{t('my_schedule.back_to_competitors')}
			</button>

			<div className={b('competitor-profile')}>
				{selected.avatar ? (
					<img src={selected.avatar} alt="" className={b('competitor-avatar')} />
				) : (
					<div className={b('competitor-avatar-placeholder')}>
						<Users size={24} />
					</div>
				)}
				<div className={b('competitor-header')}>
					<h3 className={b('competitor-name')}>
						{selected.country && (
							<span className={b('competitor-flag')}>{countryFlag(selected.country)} </span>
						)}
						{selected.name}
					</h3>
					<div className={b('competitor-meta')}>
						{selected.wcaId && (
							<span
								className={b('competitor-wca-id')}
								onClick={(e) => {
									e.stopPropagation();
									openInAppBrowser(`https://www.worldcubeassociation.org/persons/${selected.wcaId}`);
								}}
								style={{cursor: 'pointer'}}
							>
								{selected.wcaId}
							</span>
						)}
						{selected.country && (
							<span className={b('competitor-country-code')}>{selected.country}</span>
						)}
					</div>
				</div>
				</div>

			{selected.registeredEvents?.length > 0 && (
				<div className={b('events-badges')}>
					{selected.registeredEvents.map((eid: string) => (
						<EventIcon key={eid} eventId={eid} size={14} />
					))}
				</div>
			)}

			{/* Action buttons */}
			<div className={b('competitor-actions')}>
				{selected.wcaId && (
					<button
						className={b('wca-profile-btn')}
						onClick={() => history.push(`/community/competitions/${detail.competitionId}/personal-bests/${selected.wcaId}`)}
					>
						{t('my_schedule.view_personal_records')}
					</button>
				)}
				{wcaLiveCompId && selected.wcaId && (() => {
					const live = wcaLiveCompetitors.find((c: any) => c.wcaId === selected.wcaId);
					if (!live) return null;
					return (
						<button
							className={b('wca-results-btn')}
							onClick={() => history.push(`/community/competitions/${detail.competitionId}/persons/${registrantId}/results`)}
						>
							{t('my_schedule.view_complete_results')}
						</button>
					);
				})()}
			</div>

			{/* Disclaimer */}
			<div className={b('disclaimer')}>
				<Warning size={16} />
				<span>{t('my_schedule.times_disclaimer')}</span>
			</div>

			{selected.assignments?.length > 0 ? (
				<CompetitorDays
					assignments={selected.assignments}
					competitionId={detail.competitionId}
					locale={locale}
					t={t}
				/>
			) : (
				<div className={b('info-banner')}>
					<Info size={18} />
					<span>{t('my_schedule.no_assignments')}</span>
				</div>
			)}
		</div>
	);
}

// --- Competitor Day Accordion ---

function CompetitorDays({assignments, competitionId, locale, t}: any) {
	const history = useHistory();
	const now = useNow(60000);
	const [openDays, setOpenDays] = useState<Set<string>>(new Set());

	const dayMap = useMemo(() => {
		const map = new Map<string, any[]>();
		for (const a of assignments) {
			const date = a.startTime ? a.startTime.substring(0, 10) : 'unknown';
			if (!map.has(date)) map.set(date, []);
			map.get(date).push(a);
		}
		return Array.from(map.entries()).sort(([a], [bk]) => a.localeCompare(bk));
	}, [assignments]);

	// Default acik gunler: bugun + tum gelecek gunler.
	// 4+ saat eski gunler otomatik kapali.
	useEffect(() => {
		if (dayMap.length === 0 || openDays.size > 0) return;
		const FOUR_HOURS = 4 * 60 * 60 * 1000;
		const initialOpen = new Set<string>();
		for (const [date, dayAssignments] of dayMap) {
			if (date === 'unknown') {
				initialOpen.add(date);
				continue;
			}
			// Gun icindeki son activity'nin bitis zamanini bul
			let lastEnd = 0;
			for (const a of dayAssignments) {
				if (a.endTime) {
					const ts = new Date(a.endTime).getTime();
					if (ts > lastEnd) lastEnd = ts;
				}
			}
			// Eger son activity 4 saatten kisa sure once bitti veya hala bitmedi → ac
			if (lastEnd === 0 || (Date.now() - lastEnd) < FOUR_HOURS) {
				initialOpen.add(date);
			}
		}
		// Hicbiri acilmadiysa son gunu ac
		if (initialOpen.size === 0 && dayMap.length > 0) {
			initialOpen.add(dayMap[dayMap.length - 1][0]);
		}
		setOpenDays(initialOpen);
	}, [dayMap]);

	function isCurrent(a: any): boolean {
		if (!a.startTime || !a.endTime) return false;
		const start = new Date(a.startTime).getTime();
		const end = new Date(a.endTime).getTime();
		return now >= start && now < end;
	}

	function isPast(a: any): boolean {
		if (!a.endTime) return false;
		return now >= new Date(a.endTime).getTime();
	}

	function toggleDay(date: string) {
		setOpenDays((prev) => {
			const next = new Set(prev);
			if (next.has(date)) next.delete(date);
			else next.add(date);
			return next;
		});
	}

	return (
		<div className={b('assignment-days')}>
			{dayMap.map(([date, dayAssignments]) => {
				const isOpen = openDays.has(date);
				return (
					<div key={date} className={b('assignment-day')}>
						<button className={b('assignment-day-header', {open: isOpen})} onClick={() => toggleDay(date)}>
							<div className={b('assignment-day-left')}>
								<CalendarBlank size={16} />
								{date !== 'unknown' ? formatDayHeader(date, locale) : '-'}
							</div>
							<span className={b('assignment-day-arrow')}>{isOpen ? '\u25B2' : '\u25BC'}</span>
						</button>
						{isOpen && (
							<div className={b('assignment-table-wrapper')}>
								<table className={b('assignment-table')}>
									<thead>
										<tr>
											<th>{t('my_schedule.col_activity')}</th>
											<th>{t('my_schedule.col_time')}</th>
											<th>{t('my_schedule.col_assignment')}</th>
											<th>{t('my_schedule.col_group')}</th>
											<th>{dayAssignments.some((a: any) => a.stationNumber) ? t('my_schedule.col_station') : t('my_schedule.col_stage')}</th>
										</tr>
									</thead>
									<tbody>
										{dayAssignments.map((a: any, idx: number) => (
											<tr
												key={idx}
												className={b('assignment-row', {
													current: isCurrent(a),
													past: isPast(a) && !isCurrent(a),
												})}
												onClick={() => history.push(`/community/competitions/${competitionId}/activities/${a.activityCode}`)}
											>
												<td>
													{a.eventName}
													{a.roundNumber > 0 && ` R${a.roundNumber}`}
												</td>
												<td>{a.startTime ? formatTime(a.startTime, locale) : '-'}</td>
												<td>
													<span className={b('role', {type: ROLE_COLORS[a.assignmentCode] || 'gray'})}>
														{getRoleLabel(a.assignmentCode, t)}
													</span>
												</td>
												<td className={b('group-num')}>{a.groupNumber || '-'}</td>
												<td>{a.stationNumber ? a.stationNumber : (a.roomName || '-')}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
