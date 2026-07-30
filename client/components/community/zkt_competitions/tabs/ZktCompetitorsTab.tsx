import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory, useParams} from 'react-router-dom';
import {MagnifyingGlass} from 'phosphor-react';
import {b, competitorDisplayName, competitorFlag, competitorExtId} from '../shared';

// Competitor list for a federation competition (the Groups/Yarismacilar tab).
// `detail.competitors` arrives already opaque-keyed and ordered by registrant
// number from the federation — this view just searches + renders. Follow bells
// and "me" pinning are personalization features that belong to a later phase
// (the public payload carries no viewer identity), so they are absent here.
export default function ZktCompetitorsTab({detail}: {detail: any}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();
	const {competitionId} = useParams<{competitionId: string}>();
	const [search, setSearch] = useState('');

	const filtered = useMemo(() => {
		const all = detail.competitors || [];
		const q = search.trim().toLowerCase();
		if (!q) return all;
		return all.filter((c: any) => {
			const extId = (competitorExtId(c) || '').toLowerCase();
			return competitorDisplayName(c).toLowerCase().includes(q) || extId.includes(q);
		});
	}, [detail.competitors, search]);

	return (
		<div className={b('competitors-tab')}>
			{/* WCA-paritede arama + sayac */}
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
					{filtered.map((c: any, idx: number) => {
						const displayName = competitorDisplayName(c) || c.id;
						const flag = competitorFlag(c);
						const extId = competitorExtId(c);
						return (
							<div
								key={c.id}
								className={b('competitor-row')}
								onClick={() =>
									history.push(`/zkt-competitions/${competitionId}/competitors/${c.id}`)
								}
							>
								<span className={b('competitor-number')}>
									{c.registrationNumber ?? idx + 1}
								</span>
								<div className={b('competitor-info')}>
									<span className={b('competitor-name-list')}>
										{flag && <span className={b('flag')}>{flag}</span>}
										{displayName}
									</span>
									{extId && <span className={b('competitor-id')}>{extId}</span>}
								</div>
								{/* Which day they attend, on a day-split competition. Two
								    competitors of the same competition can be there on different
								    mornings, and the list is where that first becomes visible. */}
								{c.dayLabel && <span className={b('competitor-day')}>{c.dayLabel}</span>}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
