import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory, useParams} from 'react-router-dom';
import {useSelector} from 'react-redux';
import {MagnifyingGlass} from 'phosphor-react';
import {b, getEventName, competitorDisplayName, competitorFlag, competitorOf, ZKT_ROLE_COLORS} from '../shared';

// Staff role colors/labels — shared source so badges look consistent everywhere.
const ROLE_TINT = ZKT_ROLE_COLORS;
const ROLE_LABEL_KEY: Record<string, string> = {
	JUDGE: 'role_judge', SCRAMBLER: 'role_scrambler', RUNNER: 'role_runner', ORGANIZER: 'role_organizer', STAFF: 'role_staff',
};

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

	// Staff roles (JUDGE/SCRAMBLER/RUNNER) per user, gathered across all rounds —
	// so the competitor list itself shows who is staffing, not just who competes.
	const staffRolesByUser = useMemo(() => {
		const m = new Map<string, Set<string>>();
		for (const ev of detail.events || []) {
			for (const rd of ev.rounds || []) {
				for (const a of rd.assignments || []) {
					if (!a.role || a.role === 'COMPETITOR') continue;
					const key = a.user_id || a.person_id;
					if (!key) continue;
					if (!m.has(key)) m.set(key, new Set());
					m.get(key)!.add(a.role);
				}
			}
		}
		return m;
	}, [detail.events]);

	const filtered = useMemo(() => {
		const approved = detail.registrations.filter((r: any) => r.status === 'APPROVED');
		const q = search.trim().toLowerCase();
		const matched = q
			? approved.filter(
					(r: any) =>
						(competitorOf(r)?.username || '').toLowerCase().includes(q) ||
						competitorDisplayName(competitorOf(r)).toLowerCase().includes(q)
				)
			: approved;
		// Pin "me" to the top so I always see my own registration first.
		return [...matched].sort((a: any, bx: any) => {
			if (me) {
				if (a.user_id === me.id) return -1;
				if (bx.user_id === me.id) return 1;
			}
			return competitorDisplayName(competitorOf(a)).localeCompare(competitorDisplayName(competitorOf(bx)));
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
										`/community/zkt-competitions/${competitionId}/competitors/${r.user_id || r.person_id}`
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
										{competitorFlag(competitorOf(r)) && (
											<span className={b('flag')}>{competitorFlag(competitorOf(r))}</span>
										)}
										{competitorDisplayName(competitorOf(r)) || r.user_id || r.person_id}
										{isMe && (
											<span className={b('me-badge')}>{t('you')}</span>
										)}
									</span>
								</div>
								{(() => {
									const roles = staffRolesByUser.get(r.user_id || r.person_id);
									if (!roles || roles.size === 0) return null;
									return (
										<div className={b('competitor-roles')}>
											{Array.from(roles).map((role) => (
												<span
													key={role}
													className={b('role-pill', {mini: true})}
													style={{
														background: `${ROLE_TINT[role]}22`,
														color: ROLE_TINT[role],
														border: `1px solid ${ROLE_TINT[role]}55`,
													}}
												>
													{t(ROLE_LABEL_KEY[role] || role)}
												</span>
											))}
										</div>
									);
								})()}
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
