import React from 'react';
import {useTranslation} from 'react-i18next';
import {b, getEventName, formatCs, formatName} from '../shared';

export default function ZktEventsTab({detail}: {detail: any}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});

	return (
		<div className={b('events-tab')}>
			{detail.events.length === 0 ? (
				<div className={b('empty')}>{t('no_events')}</div>
			) : (
				<div className={b('events-list')}>
					{detail.events.map((ev: any) => (
						<div key={ev.id} className={b('event-card')}>
							<div className={b('event-card-header')}>
								<span className={`cubing-icon event-${ev.event_id}`} style={{fontSize: 24}} />
								<div>
									<div className={b('event-card-title')}>{getEventName(ev.event_id)}</div>
									<div className={b('event-card-sub')}>
										{t('rounds_count', {count: ev.rounds.length})}
									</div>
								</div>
							</div>
							<div className={b('event-card-rounds')}>
								{ev.rounds.map((r: any) => (
									<div key={r.id} className={b('round-info-row')}>
										<span className={b('round-info-label')}>
											{t('round_n', {n: r.round_number})}
										</span>
										<span className={b('round-info-fmt')}>{formatName(r.format)}</span>
										{r.time_limit_cs && (
											<span className={b('round-info-meta')}>
												{t('time_limit_short')}: {formatCs(r.time_limit_cs)}
											</span>
										)}
										{r.cutoff_cs && (
											<span className={b('round-info-meta')}>
												{t('cutoff_short')}: {formatCs(r.cutoff_cs)}
											</span>
										)}
										{r.advancement_type && r.advancement_level && (
											<span className={b('round-info-meta')}>
												{r.advancement_type === 'PERCENT'
													? `${t('advancement_short')}: ${r.advancement_level}%`
													: `${t('advancement_short')}: Top ${r.advancement_level}`}
											</span>
										)}
										<span className={b('round-status-pill', {[r.status.toLowerCase()]: true})}>
											{t(`round_status_${r.status.toLowerCase()}`)}
										</span>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
