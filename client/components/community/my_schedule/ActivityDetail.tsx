import React, {useMemo, useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {ArrowLeft, ArrowRight, Info, MapPin} from 'phosphor-react';
import {useCompetitionData} from './CompetitionLoader';
import {
	b, I18N_LOCALE_MAP, formatTime, formatWcaTime, getRoleLabel,
	parseActivityCodeLabel, parseActivityCodeParts, formatRoundFormat,
} from './shared';

const ROLE_HEADER_COLORS: Record<string, string> = {
	competitor: 'rgba(34, 197, 94, 0.2)',
	'staff-scrambler': 'rgba(234, 179, 8, 0.2)',
	'staff-runner': 'rgba(249, 115, 22, 0.2)',
	'staff-judge': 'rgba(59, 130, 246, 0.2)',
	'staff-dataentry': 'rgba(107, 114, 128, 0.15)',
	'staff-announcer': 'rgba(236, 72, 153, 0.15)',
};

const ROLE_HEADER_BORDER: Record<string, string> = {
	competitor: '#22c55e',
	'staff-scrambler': '#eab308',
	'staff-runner': '#f97316',
	'staff-judge': '#3b82f6',
	'staff-dataentry': '#6b7280',
	'staff-announcer': '#ec4899',
};

interface ActivityDetailProps {
	activityCode: string;
}

export default function ActivityDetail({activityCode}: ActivityDetailProps) {
	const {t, i18n} = useTranslation();
	const history = useHistory();
	const {detail} = useCompetitionData();
	const locale = I18N_LOCALE_MAP[i18n.language] || i18n.language;

	const parsed = parseActivityCodeParts(activityCode);

	const roundMeta = useMemo(() => {
		if (!parsed || !detail?.events) return null;
		const event = detail.events.find((e: any) => e.eventId === parsed.eventId);
		if (!event) return null;
		return event.rounds.find((r: any) => r.roundNumber === parsed.roundNumber) || null;
	}, [detail, parsed]);

	const {prevCode, nextCode, navLabel} = useMemo(() => {
		if (!parsed || !detail?.events) return {prevCode: null, nextCode: null, navLabel: 'group' as const};

		if (parsed.groupNumber && roundMeta) {
			// Grup seviyesi: prev/next grup
			const maxGroup = roundMeta.groups.length;
			return {
				prevCode: parsed.groupNumber > 1
					? `${parsed.eventId}-r${parsed.roundNumber}-g${parsed.groupNumber - 1}` : null,
				nextCode: parsed.groupNumber < maxGroup
					? `${parsed.eventId}-r${parsed.roundNumber}-g${parsed.groupNumber + 1}` : null,
				navLabel: 'group' as const,
			};
		}

		// Round seviyesi: prev/next round (ayni event icinde)
		const event = detail.events.find((e: any) => e.eventId === parsed.eventId);
		const maxRound = event?.rounds?.length || 0;
		return {
			prevCode: parsed.roundNumber > 1
				? `${parsed.eventId}-r${parsed.roundNumber - 1}` : null,
			nextCode: parsed.roundNumber < maxRound
				? `${parsed.eventId}-r${parsed.roundNumber + 1}` : null,
			navLabel: 'round' as const,
		};
	}, [parsed, roundMeta, detail]);

	const peopleInActivity = useMemo(() => {
		if (!detail?.competitors) return [];

		// Once exact match dene, yoksa prefix ile ara (orn. "skewb-r1" → "skewb-r1-g1", "skewb-r1-g2")
		const prefix = activityCode + '-';
		const matchFn = (a: any) => a.activityCode === activityCode || a.activityCode.startsWith(prefix);

		return detail.competitors
			.filter((c: any) => c.assignments.some(matchFn))
			.map((c: any) => ({
				...c,
				assignment: c.assignments.find(matchFn),
			}));
	}, [detail, activityCode]);

	const seedMap = useMemo(() => {
		if (!parsed || !roundMeta) return new Map<number, number>();
		const map = new Map<number, number>();
		for (const group of roundMeta.groups) {
			for (const comp of group.competitors) {
				if (comp.seedResult && comp.assignmentCode === 'competitor') {
					map.set(comp.registrantId, comp.seedResult);
				}
			}
		}
		return map;
	}, [roundMeta, parsed]);

	// Sira: Yarismaci → Karistirmaci → Runner → Hakem
	const byRole = useMemo(() => {
		const map = new Map<string, any[]>();
		for (const p of peopleInActivity) {
			const code = p.assignment.assignmentCode;
			if (!map.has(code)) map.set(code, []);
			map.get(code).push(p);
		}
		const order = ['competitor', 'staff-scrambler', 'staff-runner', 'staff-judge'];
		const sorted = new Map<string, any[]>();
		for (const role of order) {
			if (map.has(role)) {
				const people = map.get(role);
				if (role === 'competitor') {
					people.sort((a: any, bx: any) => {
						const sa = seedMap.get(a.registrantId) || Infinity;
						const sb = seedMap.get(bx.registrantId) || Infinity;
						if (sa !== sb) return sa - sb;
						return a.name.localeCompare(bx.name);
					});
				} else {
					people.sort((a: any, bx: any) => a.name.localeCompare(bx.name));
				}
				sorted.set(role, people);
				map.delete(role);
			}
		}
		for (const [role, people] of map.entries()) {
			sorted.set(role, people.sort((a: any, bx: any) => a.name.localeCompare(bx.name)));
		}
		return sorted;
	}, [peopleInActivity, seedMap]);

	const timeInfo = peopleInActivity[0]?.assignment;

	// Klavye kisayollari: Sol/Sag ok tuslari
	useEffect(() => {
		function handleKeydown(e: KeyboardEvent) {
			if (e.key === 'ArrowLeft' && prevCode) {
				history.push(`/community/competitions/${detail.competitionId}/activities/${prevCode}`);
			}
			if (e.key === 'ArrowRight' && nextCode) {
				history.push(`/community/competitions/${detail.competitionId}/activities/${nextCode}`);
			}
		}
		document.addEventListener('keydown', handleKeydown);
		return () => document.removeEventListener('keydown', handleKeydown);
	}, [prevCode, nextCode, detail?.competitionId]);
	const activityLabel = parseActivityCodeLabel(activityCode);
	const hasSeeds = seedMap.size > 0;

	if (peopleInActivity.length === 0) {
		return (
			<div className={b('activity-detail')}>
				<h2 className={b('activity-title')}>{activityLabel}</h2>
				<div className={b('info-banner')}>
					<Info size={18} />
					<span>{t('my_schedule.no_people_in_activity')}</span>
				</div>
			</div>
		);
	}

	function goToPerson(registrantId: number) {
		history.push(`/community/competitions/${detail.competitionId}/persons/${registrantId}`);
	}

	return (
		<div className={b('activity-detail')}>
			<button className={b('back-sm')} onClick={() => history.goBack()}>
				<ArrowLeft size={16} />
				{t('my_schedule.back_to_competitors')}
			</button>

			{/* Prev/Next */}
			{(prevCode || nextCode) && (
				<div className={b('group-nav')}>
					<button
						className={b('group-nav-btn', {disabled: !prevCode})}
						disabled={!prevCode}
						onClick={() => prevCode && history.push(`/community/competitions/${detail.competitionId}/activities/${prevCode}`)}
					>
						<ArrowLeft size={14} />
						{navLabel === 'round' ? t('my_schedule.prev_round') : t('my_schedule.prev_group')}
					</button>
					<button
						className={b('group-nav-btn', {disabled: !nextCode})}
						disabled={!nextCode}
						onClick={() => nextCode && history.push(`/community/competitions/${detail.competitionId}/activities/${nextCode}`)}
					>
						{navLabel === 'round' ? t('my_schedule.next_round') : t('my_schedule.next_group')}
						<ArrowRight size={14} />
					</button>
				</div>
			)}

			<h2 className={b('activity-title')}>{activityLabel}</h2>

			{timeInfo && (
				<div className={b('activity-meta')}>
					{timeInfo.startTime && (
						<span className={b('activity-time')}>
							{formatTime(timeInfo.startTime, locale)}
							{timeInfo.endTime && ` - ${formatTime(timeInfo.endTime, locale)}`}
						</span>
					)}
					{timeInfo.roomName && (
						<span className={b('activity-room')}>
							<MapPin size={14} />
							{timeInfo.roomName}
						</span>
					)}
				</div>
			)}

			{roundMeta && (
				<div className={b('round-info')}>
					{roundMeta.format && (
						<span className={b('round-info-item')}>{formatRoundFormat(roundMeta.format)}</span>
					)}
					{roundMeta.timeLimit && (
						<span className={b('round-info-item')}>
							{t('my_schedule.time_limit')}: {formatWcaTime(roundMeta.timeLimit)}
						</span>
					)}
					{roundMeta.cutoff && (
						<span className={b('round-info-item')}>
							{t('my_schedule.cutoff')}: {formatWcaTime(roundMeta.cutoff)}
						</span>
					)}
					{roundMeta.advancementType && roundMeta.advancementLevel && (
						<span className={b('round-info-item')}>
							{roundMeta.advancementType === 'percent'
								? t('my_schedule.advancement_top_percent', {level: roundMeta.advancementLevel})
								: t('my_schedule.advancement_top_ranking', {level: roundMeta.advancementLevel})}
						</span>
					)}
				</div>
			)}

			<span className={b('competitor-count')}>
				{t('my_schedule.activity_people_count', {count: peopleInActivity.length})}
			</span>

			{/* Role sections */}
			{Array.from(byRole.entries()).map(([role, people]) => {
				const headerBg = ROLE_HEADER_COLORS[role] || 'rgba(107, 114, 128, 0.15)';
				const headerBorder = ROLE_HEADER_BORDER[role] || '#6b7280';
				const isCompetitor = role === 'competitor';
				const showSeedTable = isCompetitor && hasSeeds;

				return (
					<div key={role} className={b('activity-role-group')}>
						{/* Renkli header - referans gibi */}
						<div
							className={b('activity-section-header')}
							style={{backgroundColor: headerBg, borderBottomColor: headerBorder}}
						>
							<span className={b('activity-section-title')}>{getRoleLabel(role, t)}</span>
							<span className={b('activity-section-count')}>({people.length})</span>
						</div>

						{showSeedTable ? (
							/* Yarismaci tablosu: Name | Seed Result | Station Number */
							<div className={b('activity-table-wrapper')}>
								<table className={b('activity-table')}>
									<thead>
										<tr>
											<th>{t('my_schedule.col_name')}</th>
											<th>{t('my_schedule.seed_result')}</th>
											<th>{t('my_schedule.col_station')}</th>
										</tr>
									</thead>
									<tbody>
										{people.map((p: any) => (
											<tr
												key={p.registrantId}
												className={b('assignment-row')}
												onClick={() => goToPerson(p.registrantId)}
											>
												<td>{p.name}</td>
												<td className={b('seed-result')}>
													{seedMap.get(p.registrantId) ? formatWcaTime(seedMap.get(p.registrantId)) : '-'}
												</td>
												<td className={b('events-cell-center')}>{p.assignment.stationNumber || '-'}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							/* Tek sutun liste, role rengine gore zebra */
							<div className={[
								b('activity-role-list'),
								role === 'competitor' ? b('activity-role-list', {competitor: true}) : '',
								role === 'staff-scrambler' ? b('activity-role-list', {scrambler: true}) : '',
								role === 'staff-runner' ? b('activity-role-list', {runner: true}) : '',
								role === 'staff-judge' ? b('activity-role-list', {judge: true}) : '',
							].filter(Boolean).join(' ')}>
								{people.map((p: any) => (
									<div
										key={p.registrantId}
										className={b('activity-role-row')}
										onClick={() => goToPerson(p.registrantId)}
									>
										{p.name}
									</div>
								))}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
