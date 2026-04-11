import React, {useMemo, Component, ErrorInfo, ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {Info, Warning, ArrowClockwise} from 'phosphor-react';
import i18n from '../../../../i18n/i18n';
import {useCompetitionData} from '../CompetitionLoader';
import {useWcaLiveOverview} from '../useLiveResults';
import {b, EventIcon} from '../shared';
import {useIsMobile} from '../../../../util/hooks/useIsMobile';
import WcaLiveEventDetail from './WcaLiveEventDetail';
import WcaLiveSchedule from './WcaLiveSchedule';
import WcaLiveRecords from './WcaLiveRecords';
import WcaLivePodiums from './WcaLivePodiums';

interface Props {
	eventId: string | null;
	roundNumber: number | null;
}

// Error Boundary: WCA Live tab'i icin crash isolation
class WcaLiveErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean}> {
	state = {hasError: false};

	static getDerivedStateFromError(): {hasError: boolean} {
		return {hasError: true};
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		// eslint-disable-next-line no-console
		console.error('[WcaLive] component error:', error, info);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className={b('info-banner')}>
					<Warning size={18} />
					<span>{i18n.t('my_schedule.wca_live_error')}</span>
				</div>
			);
		}
		return this.props.children;
	}
}

function WcaLiveTabInner({eventId, roundNumber}: Props) {
	const {t} = useTranslation();
	const history = useHistory();
	const {detail} = useCompetitionData();
	const isMobile = useIsMobile();

	const enabled = !!detail?.wcaLiveCompId;
	const {data: overview, loading, lastUpdated, refresh} = useWcaLiveOverview(detail?.competitionId || '', enabled);

	const selectedEvent = useMemo(() => {
		if (!overview || !eventId || !overview.events) return null;
		return overview.events.find((e: any) => e?.eventId === eventId) || null;
	}, [overview, eventId]);

	if (!enabled) {
		return (
			<div className={b('info-banner')}>
				<Info size={18} />
				<span>{t('my_schedule.wca_live_unavailable')}</span>
			</div>
		);
	}

	if (loading && !overview) {
		return <div className={b('wca-live-loading')}>{t('my_schedule.loading')}</div>;
	}

	if (!overview) {
		return (
			<div className={b('info-banner')}>
				<Info size={18} />
				<span>{t('my_schedule.wca_live_unavailable')}</span>
			</div>
		);
	}

	if (!overview.events || overview.events.length === 0) {
		return (
			<div className={b('info-banner')}>
				<Info size={18} />
				<span>{t('my_schedule.wca_live_no_events')}</span>
			</div>
		);
	}

	function handleEventClick(eid: string) {
		history.push(`/community/competitions/${detail.competitionId}/wca-live/${eid}`);
	}

	return (
		<div className={b('wca-live')}>
			{/* Event secici: mobilde dropdown, web'de wrap chip'ler */}
			{isMobile ? (
				<div className={b('wca-live-event-select-wrapper')}>
					<select
						className={b('wca-live-event-select')}
						value={eventId || ''}
						onChange={(e) => {
							const val = e.target.value;
							if (val) handleEventClick(val);
							else history.push(`/community/competitions/${detail.competitionId}/wca-live`);
						}}
					>
						<option value="">{t('my_schedule.wca_live_select_event')}</option>
						{overview.events.map((event) => (
							<option key={event.eventId} value={event.eventId}>
								{event.eventName}
							</option>
						))}
					</select>
				</div>
			) : (
				<div className={b('wca-live-event-chips')}>
					{overview.events.map((event) => {
						const isActive = event.eventId === eventId;
						return (
							<button
								key={event.eventId}
								className={b('wca-live-event-chip', {active: isActive})}
								onClick={() => handleEventClick(event.eventId)}
								title={event.eventName}
							>
								<EventIcon eventId={event.eventId} size={18} />
								<span className={b('wca-live-event-chip-label')}>{event.eventName}</span>
							</button>
						);
					})}
				</div>
			)}

			{selectedEvent ? (
				<WcaLiveEventDetail
					event={selectedEvent}
					competitionId={detail.competitionId}
					roundNumber={roundNumber}
					isMobile={isMobile}
				/>
			) : (
				<div className={b('wca-live-welcome-content')}>
					<div className={b('wca-live-welcome-header')}>
						<h2 className={b('wca-live-welcome-title')}>{overview.name}</h2>
						<button
							className={b('wca-live-refresh-btn', {spinning: loading})}
							onClick={refresh}
							title={t('my_schedule.refresh')}
							disabled={loading}
						>
							<ArrowClockwise size={18} />
						</button>
					</div>
					{/* Active Rounds */}
					{(() => {
						const activeRounds: {eventId: string; eventName: string; roundName: string; roundNumber: number}[] = [];
						for (const ev of overview.events || []) {
							for (const r of ev.rounds || []) {
								if (r.active) {
									activeRounds.push({eventId: ev.eventId, eventName: ev.eventName, roundName: r.name, roundNumber: r.number});
								}
							}
						}
						if (activeRounds.length === 0) return null;
						return (
							<div className={b('wca-live-active-rounds')}>
								<h3 className={b('wca-live-section-title')}>{t('my_schedule.wca_live_active_rounds')}</h3>
								<div className={b('wca-live-active-rounds-grid')}>
									{activeRounds.map((ar) => (
										<button
											key={`${ar.eventId}-${ar.roundNumber}`}
											className={b('wca-live-active-round-card')}
											onClick={() => history.push(`/community/competitions/${detail.competitionId}/wca-live/${ar.eventId}/${ar.roundNumber}`)}
										>
											<EventIcon eventId={ar.eventId} size={22} />
											<span className={b('wca-live-active-round-name')}>{ar.roundName}</span>
											<span className={b('wca-live-status-badge', {live: true})}>
												{t('my_schedule.round_status_live')}
											</span>
										</button>
									))}
								</div>
							</div>
						);
					})()}
					<WcaLivePodiums podiums={overview.podiums || []} competitionId={detail.competitionId} />
					<WcaLiveSchedule schedule={overview.schedule} competitionId={detail.competitionId} />
					<WcaLiveRecords records={overview.records} competitionId={detail.competitionId} />
				</div>
			)}
		</div>
	);
}

export default function WcaLiveTab(props: Props) {
	return (
		<WcaLiveErrorBoundary>
			<WcaLiveTabInner {...props} />
		</WcaLiveErrorBoundary>
	);
}
