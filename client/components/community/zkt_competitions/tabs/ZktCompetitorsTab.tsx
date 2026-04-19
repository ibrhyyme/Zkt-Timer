import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory, useParams} from 'react-router-dom';
import {useSelector} from 'react-redux';
import {MagnifyingGlass} from 'phosphor-react';
import {b, getEventName} from '../shared';

export default function ZktCompetitorsTab({detail}: {detail: any}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();
	const {competitionId} = useParams<{competitionId: string}>();
	const me = useSelector((state: any) => state.account.me);
	const [search, setSearch] = useState('');

	const compEventMap = useMemo(() => {
		const m = new Map<string, string>();
		detail.events.forEach((e: any) => m.set(e.id, e.event_id));
		return m;
	}, [detail.events]);

	const filtered = useMemo(() => {
		const approved = detail.registrations.filter((r: any) => r.status === 'APPROVED');
		const q = search.trim().toLowerCase();
		const matched = q
			? approved.filter((r: any) => (r.user?.username || '').toLowerCase().includes(q))
			: approved;
		// Pin "me" to the top so I always see my own registration first.
		return [...matched].sort((a: any, bx: any) => {
			if (me) {
				if (a.user_id === me.id) return -1;
				if (bx.user_id === me.id) return 1;
			}
			return (a.user?.username || '').localeCompare(bx.user?.username || '');
		});
	}, [detail.registrations, search, me]);

	return (
		<div className={b('competitors-tab')}>
			{/* WCA-paritede arama + sayaç */}
			<div className={b('search')}>
				<MagnifyingGlass size={16} />
				<input
					type="text"
					className={b('search-input')}
					placeholder={t('search_competitors')}
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
			</div>

			<span className={b('competitor-count')}>
				{t('total_competitors', {count: filtered.length})}
			</span>

			{filtered.length === 0 ? (
				<div className={b('empty')}>{t('no_competitors')}</div>
			) : (
				<div className={b('competitor-list')}>
					{filtered.map((r: any, idx: number) => {
						const isMe = me && r.user_id === me.id;
						return (
							<button
								key={r.id}
								type="button"
								className={b('competitor-card', {me: isMe})}
								onClick={() =>
									history.push(
										`/community/zkt-competitions/${competitionId}/competitors/${r.user_id}`
									)
								}
							>
								<span className={b('competitor-number')}>{idx + 1}</span>
								{r.user?.profile?.pfp_image?.url && (
									<img
										className={b('user-avatar')}
										src={r.user.profile.pfp_image.url}
										alt=""
									/>
								)}
								<div className={b('competitor-info')}>
									<span className={b('competitor-name-list')}>
										{r.user?.username || r.user_id}
										{isMe && (
											<span className={b('me-badge')}>{t('you')}</span>
										)}
									</span>
								</div>
								<div className={b('competitor-events')}>
									{r.events.map((e: any) => {
										const eventId = compEventMap.get(e.comp_event_id);
										if (!eventId) return null;
										return (
											<span
												key={e.id}
												className={b('event-chip-mini')}
												title={getEventName(eventId)}
											>
												<span className={`cubing-icon event-${eventId}`} />
											</span>
										);
									})}
								</div>
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
