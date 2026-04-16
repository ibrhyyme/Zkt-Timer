import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory, useParams} from 'react-router-dom';
import {b, getEventName} from '../shared';

export default function ZktCompetitorsTab({detail}: {detail: any}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();
	const {competitionId} = useParams<{competitionId: string}>();
	const [search, setSearch] = useState('');

	const approved = detail.registrations.filter((r: any) => r.status === 'APPROVED');
	const filtered = search
		? approved.filter((r: any) =>
				(r.user?.username || '').toLowerCase().includes(search.toLowerCase())
		  )
		: approved;

	const compEventMap = new Map<string, string>();
	detail.events.forEach((e: any) => compEventMap.set(e.id, e.event_id));

	return (
		<div className={b('competitors-tab')}>
			<input
				className={b('search-input')}
				placeholder={t('search_competitors')}
				value={search}
				onChange={(e) => setSearch(e.target.value)}
			/>

			<div className={b('competitor-count')}>
				{t('total_competitors', {count: filtered.length})}
			</div>

			{filtered.length === 0 ? (
				<div className={b('empty')}>{t('no_competitors')}</div>
			) : (
				<div className={b('competitor-list')}>
					{filtered.map((r: any) => (
						<div
							key={r.id}
							className={b('competitor-row')}
							style={{cursor: 'pointer'}}
							onClick={() => history.push(`/community/zkt-competitions/${competitionId}/competitors/${r.user_id}`)}
						>
							{r.user?.profile?.pfp_image?.url && (
								<img
									className={b('user-avatar')}
									src={r.user.profile.pfp_image.url}
									alt=""
								/>
							)}
							<span className={b('user-name')}>{r.user?.username || r.user_id}</span>
							<div className={b('competitor-events')}>
								{r.events.map((e: any) => {
									const eventId = compEventMap.get(e.comp_event_id);
									if (!eventId) return null;
									return (
										<span
											key={e.id}
											className={b('event-chip')}
											title={getEventName(eventId)}
										>
											<span className={`cubing-icon event-${eventId}`} />
										</span>
									);
								})}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
