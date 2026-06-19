import React, {useMemo, useState, useEffect, useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory, useParams} from 'react-router-dom';
import {useSelector} from 'react-redux';
import {MagnifyingGlass} from 'phosphor-react';
import {gql} from '@apollo/client';
import {gqlQuery} from '../../../api';
import {b, competitorDisplayName, competitorFlag, competitorOf} from '../shared';
import ZktFollowBellButton from '../ZktFollowBellButton';

// Only the follow edges are needed here (id + which competitor) — the bell
// re-fetches via onChanged after follow/unfollow.
const MY_FOLLOWS_QUERY = gql`
	query myZktCompetitionFollows($competitionId: String!) {
		myZktCompetitionFollows(competitionId: $competitionId) {
			id
			followed_user_id
			followed_person_id
		}
	}
`;

// Competitor's external identifier, shown WCA-style under the name. Ghost
// persons carry a denormalized wca_id/external_id; account users don't expose
// a WCA id here (integration lives elsewhere), so theirs is simply blank.
function competitorIdOf(r: any): string | null {
	if (r.person) return r.person.wca_id || r.person.external_id || null;
	return null;
}

export default function ZktCompetitorsTab({detail}: {detail: any}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const history = useHistory();
	const {competitionId} = useParams<{competitionId: string}>();
	const me = useSelector((state: any) => state.account.me);
	const [search, setSearch] = useState('');
	const [follows, setFollows] = useState<any[]>([]);

	const refetchFollows = useCallback(async () => {
		if (!me) {
			setFollows([]);
			return;
		}
		try {
			const res = await gqlQuery(MY_FOLLOWS_QUERY, {competitionId});
			setFollows((res.data as any)?.myZktCompetitionFollows || []);
		} catch {
			/* non-fatal — bells just render the unfollowed state */
		}
	}, [me, competitionId]);

	useEffect(() => {
		refetchFollows();
	}, [refetchFollows]);

	const filtered = useMemo(() => {
		const approved = detail.registrations.filter((r: any) => r.status === 'APPROVED');
		const q = search.trim().toLowerCase();
		const matched = q
			? approved.filter((r: any) => {
					const idy = competitorOf(r);
					const compId = (competitorIdOf(r) || '').toLowerCase();
					return (
						(idy?.username || '').toLowerCase().includes(q) ||
						competitorDisplayName(idy).toLowerCase().includes(q) ||
						compId.includes(q)
					);
				})
			: approved;
		// Pin "me" to the top so I always see my own registration first.
		return [...matched].sort((a: any, bx: any) => {
			if (me) {
				if (a.user_id === me.id) return -1;
				if (bx.user_id === me.id) return 1;
			}
			return competitorDisplayName(competitorOf(a)).localeCompare(
				competitorDisplayName(competitorOf(bx))
			);
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
						const idy = competitorOf(r);
						const displayName = competitorDisplayName(idy) || r.user_id || r.person_id;
						const flag = competitorFlag(idy);
						const compId = competitorIdOf(r);
						const followEntry = follows.find(
							(f) =>
								(r.user_id && f.followed_user_id === r.user_id) ||
								(r.person_id && f.followed_person_id === r.person_id)
						);
						return (
							<div
								key={r.id}
								className={b('competitor-row', {me: isMe})}
								onClick={() =>
									history.push(
										`/zkt-competitions/${competitionId}/competitors/${r.user_id || r.person_id}`
									)
								}
							>
								<span className={b('competitor-number')}>{idx + 1}</span>
								<div className={b('competitor-info')}>
									<span className={b('competitor-name-list')}>
										{flag && <span className={b('flag')}>{flag}</span>}
										{displayName}
										{isMe && <span className={b('me-badge')}>{t('you')}</span>}
									</span>
									{compId && <span className={b('competitor-id')}>{compId}</span>}
								</div>
								{!isMe && (
									<ZktFollowBellButton
										competitionId={competitionId}
										followedUserId={r.user_id}
										followedPersonId={r.person_id}
										name={displayName}
										isFollowing={!!followEntry}
										followId={followEntry?.id}
										followCount={follows.length}
										onChanged={refetchFollows}
									/>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
