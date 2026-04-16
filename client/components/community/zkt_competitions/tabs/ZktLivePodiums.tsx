import React from 'react';
import {useTranslation} from 'react-i18next';
import {b, getEventName, formatCs} from '../shared';

interface Props {
	detail: any;
	results: Map<string, any[]>;
}

export default function ZktLivePodiums({detail, results}: Props) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});

	const podiums: Array<{
		eventId: string;
		eventName: string;
		top3: Array<{username: string; best: number; average: number | null; ranking: number; avatarUrl?: string}>;
	}> = [];

	for (const ev of detail.events) {
		const lastFinished = [...ev.rounds].reverse().find((r: any) => r.status === 'FINISHED');
		if (!lastFinished) continue;

		const roundResults = results.get(lastFinished.id);
		if (!roundResults || roundResults.length === 0) continue;

		const sorted = [...roundResults].sort((a: any, b: any) => (a.ranking || 999) - (b.ranking || 999));
		const top3 = sorted.slice(0, 3).map((r: any) => ({
			username: r.user?.username || r.user_id,
			best: r.best,
			average: r.average,
			ranking: r.ranking || 0,
			avatarUrl: r.user?.profile?.pfp_image?.url,
		}));

		if (top3.length > 0) {
			podiums.push({
				eventId: ev.event_id,
				eventName: getEventName(ev.event_id),
				top3,
			});
		}
	}

	if (podiums.length === 0) return null;

	const medals = ['#FFD700', '#C0C0C0', '#CD7F32'];

	return (
		<div style={{marginBottom: '2rem'}}>
			<h3 className={b('section-title')}>{t('podiums')}</h3>
			<div className={b('event-chips')} style={{flexDirection: 'column', gap: '1rem'}}>
				{podiums.map((pod) => (
					<div key={pod.eventId} className={b('event-card')}>
						<div className={b('event-card-header')}>
							<span className={`cubing-icon event-${pod.eventId}`} style={{fontSize: 24}} />
							<div className={b('event-card-title')}>{pod.eventName}</div>
						</div>
						<div style={{display: 'flex', gap: '0.75rem', flexWrap: 'wrap'}}>
							{pod.top3.map((p, i) => (
								<div
									key={i}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: '0.5rem',
										padding: '0.5rem 0.75rem',
										background: `${medals[i]}15`,
										borderLeft: `3px solid ${medals[i]}`,
										borderRadius: 6,
										flex: 1,
										minWidth: 140,
									}}
								>
									<span style={{fontSize: 18}}>{['🥇', '🥈', '🥉'][i]}</span>
									{p.avatarUrl && (
										<img src={p.avatarUrl} alt="" style={{width: 24, height: 24, borderRadius: '50%'}} />
									)}
									<span style={{fontWeight: 600, fontSize: 14, color: 'rgb(var(--text-color))'}}>{p.username}</span>
									<span style={{marginLeft: 'auto', fontFamily: 'monospace', fontWeight: 700, color: 'rgb(var(--text-color))'}}>
										{formatCs(p.best)}
									</span>
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
