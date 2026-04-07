import React, {useState, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {CalendarBlank, MapPin, Info, MagnifyingGlass, Users, ListBullets, ChartBar, Globe, Broadcast} from 'phosphor-react';
import {openInAppBrowser, openInMaps} from '../../../util/external-link';
import {useCompetitionData} from './CompetitionLoader';
import {
	b, I18N_LOCALE_MAP, ROLE_COLORS, formatTime, formatDayHeader, formatWcaTime,
	getEventShortName, getRoleLabel,
	formatRoundFormat,
} from './shared';
import {useNow} from '../../../util/hooks/useNow';

type TabId = 'groups' | 'events' | 'schedule' | 'rankings' | 'info' | 'wca-live';

export default function CompetitionDetail() {
	const {t, i18n} = useTranslation();
	const history = useHistory();
	const {detail} = useCompetitionData();
	const locale = I18N_LOCALE_MAP[i18n.language] || i18n.language;

	const [activeTab, setActiveTab] = useState<TabId>('groups');
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedRankingEvent, setSelectedRankingEvent] = useState<string | null>(null);

	const TABS: {id: TabId; label: string; icon: any; count?: number}[] = [
		{id: 'groups', label: t('my_schedule.tab_groups'), icon: Users, count: detail.competitors.length},
	];

	if (detail.wcaLiveCompId) {
		TABS.push({id: 'wca-live', label: t('my_schedule.wca_live'), icon: Broadcast});
	}

	TABS.push(
		{id: 'events', label: t('my_schedule.tab_events'), icon: ListBullets, count: detail.events.length},
		{id: 'schedule', label: t('my_schedule.tab_schedule'), icon: CalendarBlank},
		{id: 'rankings', label: t('my_schedule.tab_rankings'), icon: ChartBar},
		{id: 'info', label: t('my_schedule.tab_info'), icon: Globe},
	);

	function handleTabClick(tabId: TabId) {
		if (tabId === 'wca-live') {
			history.push(`/community/competitions/${detail.competitionId}/wca-live`);
			return;
		}
		setActiveTab(tabId);
	}

	return (
		<div className={b('detail')}>
			<div className={b('detail-header')}>
				<h2 className={b('comp-name')}>{detail.competitionName}</h2>
				{detail.myRegistrationStatus && (
					<div className={b('my-status')}>
						<span className={b('status', {type: detail.myRegistrationStatus})}>
							{detail.myRegistrationStatus === 'accepted'
								? t('my_schedule.registration_accepted')
								: t('my_schedule.registration_pending')}
						</span>
					</div>
				)}
			</div>

			<div className={b('tabs')}>
				{TABS.map((tab) => (
					<button
						key={tab.id}
						className={b('tab', {active: activeTab === tab.id})}
						onClick={() => handleTabClick(tab.id)}
					>
						<tab.icon size={16} />
						{tab.label}
						{tab.count !== undefined && (
							<span className={b('tab-count')}>{tab.count}</span>
						)}
					</button>
				))}
			</div>

			<div className={b('tab-content')}>
				{activeTab === 'groups' && (
					<GroupsTab
						competitors={detail.competitors}
						myWcaId={detail.myWcaId}
						competitionId={detail.competitionId}
						searchQuery={searchQuery}
						setSearchQuery={setSearchQuery}
						t={t}
					/>
				)}
				{activeTab === 'events' && (
					<EventsTab events={detail.events} competitionId={detail.competitionId} locale={locale} t={t} />
				)}
				{activeTab === 'schedule' && (
					<ScheduleTab schedule={detail.schedule} competitionId={detail.competitionId} locale={locale} t={t} />
				)}
				{activeTab === 'rankings' && (
					<RankingsTab
						allPersonalBests={detail.allPersonalBests}
						competitionId={detail.competitionId}
						selectedEvent={selectedRankingEvent}
						setSelectedEvent={setSelectedRankingEvent}
						t={t}
					/>
				)}
				{activeTab === 'info' && (
					<InfoTab info={detail.info} t={t} />
				)}
			</div>
		</div>
	);
}

// --- Tab 1: Groups ---

function GroupsTab({competitors, myWcaId, competitionId, searchQuery, setSearchQuery, t}: any) {
	const history = useHistory();

	const filtered = useMemo(() => {
		let list = competitors;
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter((c: any) => c.name.toLowerCase().includes(q) || (c.wcaId && c.wcaId.toLowerCase().includes(q)));
		}
		if (myWcaId) {
			list = [...list].sort((a: any, bx: any) => {
				if (a.wcaId === myWcaId) return -1;
				if (bx.wcaId === myWcaId) return 1;
				return a.name.localeCompare(bx.name);
			});
		}
		return list;
	}, [competitors, searchQuery, myWcaId]);

	return (
		<div className={b('groups-tab')}>
			<div className={b('search')}>
				<MagnifyingGlass size={16} />
				<input
					type="text"
					className={b('search-input')}
					placeholder={t('my_schedule.search_competitors')}
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
				/>
			</div>

			<span className={b('competitor-count')}>
				{t('my_schedule.competitor_count', {count: filtered.length})}
			</span>

			<div className={b('competitor-list')}>
				{filtered.map((comp: any) => {
					const isMe = myWcaId && comp.wcaId === myWcaId;
					return (
						<div
							key={comp.registrantId}
							className={b('competitor-card', {me: isMe})}
							onClick={() => history.push(`/community/competitions/${competitionId}/persons/${comp.registrantId}`)}
						>
							<div className={b('competitor-info')}>
								<span className={b('competitor-name-list')}>
									{comp.name}
									{isMe && <span className={b('me-badge')}>{t('my_schedule.you')}</span>}
								</span>
								{comp.wcaId && <span className={b('competitor-id')}>{comp.wcaId}</span>}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

// --- Tab 2: Events ---

function EventsTab({events, competitionId, locale, t}: any) {
	const [expandedRound, setExpandedRound] = useState<string | null>(null);

	// Tablo satirlarini olustur: her event'in her round'u bir satir
	const rows = useMemo(() => {
		const result: any[] = [];
		for (const event of events) {
			for (let i = 0; i < event.rounds.length; i++) {
				const round = event.rounds[i];
				result.push({
					eventId: event.eventId,
					eventName: event.eventName,
					roundNumber: round.roundNumber,
					format: round.format,
					groupCount: round.groups.length,
					groups: round.groups,
					timeLimit: round.timeLimit,
					cutoff: round.cutoff,
					cutoffAttempts: round.cutoffAttempts,
					advancementType: round.advancementType,
					advancementLevel: round.advancementLevel,
					isFirstRound: i === 0,
					roundKey: `${event.eventId}-r${round.roundNumber}`,
				});
			}
		}
		return result;
	}, [events]);

	return (
		<div className={b('events-tab')}>
			<div className={b('events-table-wrapper')}>
				<table className={b('events-table')}>
					<thead>
						<tr>
							<th>{t('my_schedule.col_event')}</th>
							<th>Round</th>
							<th>Groups</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row: any) => (
							<React.Fragment key={row.roundKey}>
								<tr
									className={b('events-row', {active: expandedRound === row.roundKey})}
									onClick={() => setExpandedRound(expandedRound === row.roundKey ? null : row.roundKey)}
								>
									<td className={b('events-cell-event')}>
										{row.isFirstRound ? row.eventName : ''}
									</td>
									<td className={b('events-cell-center')}>{row.roundNumber}</td>
									<td className={b('events-cell-center')}>{row.groupCount}</td>
									<td className={b('events-cell-view')}>
										{row.groupCount > 0 && (
											<span className={b('events-view-btn')}>
												{t('my_schedule.view_round')}
											</span>
										)}
									</td>
								</tr>
								{expandedRound === row.roundKey && row.groupCount > 0 && (
									<tr className={b('events-expanded-row')}>
										<td colSpan={4}>
											<RoundPanel
												row={row}
												competitionId={competitionId}
												locale={locale}
												t={t}
											/>
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

function RoundPanel({row, competitionId, locale, t}: any) {
	const history = useHistory();

	return (
		<div className={b('round-panel')}>
			{/* Round info */}
			<div className={b('round-info')}>
				{row.format && (
					<span className={b('round-info-item')}>
						{formatRoundFormat(row.format)}
					</span>
				)}
				{row.timeLimit && (
					<span className={b('round-info-item')}>
						{t('my_schedule.time_limit')}: {formatWcaTime(row.timeLimit)}
					</span>
				)}
				{row.cutoff && (
					<span className={b('round-info-item')}>
						{t('my_schedule.cutoff')}: {formatWcaTime(row.cutoff)}
						{row.cutoffAttempts && ` (${row.cutoffAttempts} att.)`}
					</span>
				)}
				{row.advancementType && row.advancementLevel && (
					<span className={b('round-info-item')}>
						{row.advancementType === 'percent'
							? t('my_schedule.advancement_top_percent', {level: row.advancementLevel})
							: t('my_schedule.advancement_top_ranking', {level: row.advancementLevel})}
					</span>
				)}
			</div>

			{/* Grup kartlari */}
			<div className={b('group-cards')}>
				{row.groups.map((group: any) => {
					const activityCode = group.activityCode || `${row.eventId}-r${row.roundNumber}-g${group.groupNumber}`;
					return (
						<div
							key={group.groupNumber}
							className={b('group-card')}
							onClick={() => history.push(`/community/competitions/${competitionId}/activities/${activityCode}`)}
						>
							<span className={b('group-card-title')}>Group {group.groupNumber}</span>
							{group.startTime && (
								<span className={b('group-card-time')}>
									{formatTime(group.startTime, locale)}
									{group.endTime && ` - ${formatTime(group.endTime, locale)}`}
								</span>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

// --- Tab 3: Schedule ---

function ScheduleTab({schedule, competitionId, locale, t}: any) {
	const history = useHistory();
	const now = useNow(60000);
	// Ilk gun acik, digerler kapali
	const [openDays, setOpenDays] = useState<Set<string>>(() => {
		if (schedule.length > 0) return new Set([schedule[0].date]);
		return new Set();
	});

	function isOngoing(a: any): boolean {
		if (!a.startTime || !a.endTime) return false;
		const start = new Date(a.startTime).getTime();
		const end = new Date(a.endTime).getTime();
		return now >= start && now < end;
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
		<div className={b('schedule-tab')}>
			{schedule.map((day: any) => {
				const isOpen = openDays.has(day.date);
				return (
					<div key={day.date} className={b('day')}>
						<button
							className={b('day-header', {open: isOpen})}
							onClick={() => toggleDay(day.date)}
						>
							<div className={b('day-header-left')}>
								<CalendarBlank size={18} />
								<span>{formatDayHeader(day.date, locale)}</span>
							</div>
							<span className={b('day-header-arrow')}>{isOpen ? '\u25B2' : '\u25BC'}</span>
						</button>
						{isOpen && (
							<div className={b('assignments')}>
								{day.assignments.map((a: any, idx: number) => (
									<div
										key={idx}
										className={b('assignment', {clickable: true, ongoing: isOngoing(a)})}
										onClick={() => history.push(`/community/competitions/${competitionId}/activities/${a.activityCode}`)}
									>
										<div className={b('time')}>
											{formatTime(a.startTime, locale)} - {formatTime(a.endTime, locale)}
										</div>
										<div className={b('activity')}>
											<span className={b('event-name')}>{a.eventName}</span>
										</div>
										{a.assignmentCode !== 'schedule' && (
											<div className={b('role', {type: ROLE_COLORS[a.assignmentCode] || 'gray'})}>
												{getRoleLabel(a.assignmentCode, t)}
											</div>
										)}
										<div className={b('location')}>
											{a.roomColor && (
												<span className={b('room-dot')} style={{backgroundColor: a.roomColor}} />
											)}
											<MapPin size={14} />
											<span>{a.roomName}</span>
										</div>
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

// --- Tab 4: Rankings ---

function RankingsTab({allPersonalBests, competitionId, selectedEvent, setSelectedEvent, t}: any) {
	const history = useHistory();

	const eventIds = useMemo(() => {
		const ids = new Set<string>();
		for (const pb of allPersonalBests) {
			ids.add(pb.eventId);
		}
		return Array.from(ids);
	}, [allPersonalBests]);

	const filtered = useMemo(() => {
		const rows = selectedEvent
			? allPersonalBests.filter((pb: any) => pb.eventId === selectedEvent)
			: allPersonalBests.filter((pb: any) => pb.eventId === (eventIds[0] || ''));

		return [...rows].sort((a: any, b: any) => {
			const aVal = a.single || Infinity;
			const bVal = b.single || Infinity;
			return aVal - bVal;
		});
	}, [allPersonalBests, selectedEvent, eventIds]);

	const activeEvent = selectedEvent || eventIds[0] || null;

	if (eventIds.length === 0) {
		return (
			<div className={b('rankings-tab')}>
				<div className={b('info-banner')}>
					<Info size={18} />
					<span>{t('my_schedule.no_rankings')}</span>
				</div>
			</div>
		);
	}

	return (
		<div className={b('rankings-tab')}>
			<div className={b('ranking-events')}>
				{eventIds.map((eid) => (
					<button
						key={eid}
						className={b('event-chip', {active: eid === activeEvent})}
						onClick={() => setSelectedEvent(eid)}
					>
						{getEventShortName(eid)}
					</button>
				))}
			</div>

			<div className={b('ranking-table-wrapper')}>
				<table className={b('ranking-table')}>
					<thead>
						<tr>
							<th>#</th>
							<th>{t('my_schedule.col_name')}</th>
							<th>Single</th>
							<th>Average</th>
							<th>WR</th>
						</tr>
					</thead>
					<tbody>
						{filtered.map((row: any, idx: number) => (
							<tr
								key={idx}
								className={b('assignment-row')}
								onClick={() => row.wcaId && history.push(`/community/competitions/${competitionId}/personal-bests/${row.wcaId}`)}
							>
								<td className={b('rank-num')}>{idx + 1}</td>
								<td>
									<div className={b('rank-name')}>
										{row.name}
										{row.wcaId && <span className={b('rank-id')}>{row.wcaId}</span>}
									</div>
								</td>
								<td className={b('rank-time')}>{row.single ? formatWcaTime(row.single) : '-'}</td>
								<td className={b('rank-time')}>{row.average ? formatWcaTime(row.average) : '-'}</td>
								<td className={b('rank-wr')}>{row.singleWorldRank || '-'}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

// --- Tab 5: Info ---

function InfoTab({info, t}: any) {
	function renderPerson(p: any, i: number) {
		const content = (
			<>
				{p.avatar ? (
					<img src={p.avatar} alt="" className={b('info-avatar')} />
				) : (
					<div className={b('info-avatar-placeholder')}>
						<Users size={16} />
					</div>
				)}
				<div className={b('info-person-text')}>
					<span className={b('info-name')}>{p.name}</span>
					{p.wcaId && <span className={b('info-sub')}>{p.wcaId}</span>}
				</div>
			</>
		);

		if (p.wcaId) {
			return (
				<div
					key={i}
					className={b('info-person-link')}
					onClick={() => openInAppBrowser(`https://www.worldcubeassociation.org/persons/${p.wcaId}`)}
				>
					{content}
				</div>
			);
		}
		return <div key={i} className={b('info-person')}>{content}</div>;
	}

	return (
		<div className={b('info-tab')}>
			{info.wcaUrl && (
				<button className={b('wca-link')} onClick={() => openInAppBrowser(info.wcaUrl)}>
					<Globe size={16} />
					{t('my_schedule.view_wca_page')}
				</button>
			)}

			{info.venues?.length > 0 && (
				<div className={b('info-section')}>
					<h4 className={b('info-section-title')}>{t('my_schedule.venue')}</h4>
					{info.venues.map((v: any, i: number) => (
						<div
							key={i}
							className={b('info-venue-link')}
							onClick={() => openInMaps(v.name + (v.city ? ' ' + v.city : ''))}
						>
							<MapPin size={16} />
							<div>
								<span className={b('info-name')}>{v.name}</span>
								{v.address && <span className={b('info-sub')}>{v.address}</span>}
								{v.city && <span className={b('info-sub')}>{v.city}</span>}
							</div>
						</div>
					))}
				</div>
			)}

			{info.organizers?.length > 0 && (
				<div className={b('info-section')}>
					<h4 className={b('info-section-title')}>{t('my_schedule.organizers')}</h4>
					{info.organizers.map(renderPerson)}
				</div>
			)}

			{info.delegates?.length > 0 && (
				<div className={b('info-section')}>
					<h4 className={b('info-section-title')}>{t('my_schedule.delegates')}</h4>
					{info.delegates.map(renderPerson)}
				</div>
			)}
		</div>
	);
}
