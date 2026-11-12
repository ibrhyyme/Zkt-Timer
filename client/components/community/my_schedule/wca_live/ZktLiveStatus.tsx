// ZKT Live "Anlık durum" (online skor girişi, plan §6 screen 11, K3 and K4):
// the judges' unchecked times, group by group in station order. The federation
// already cut every card to what may be public (the first `level` attempts of
// the group), so this only lays it out. Official rows say so and show the
// desk's attempts.

import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {b, formatResult} from '../shared';
import type {LiveRoundData} from '../useLiveResults';

type LiveEntry = NonNullable<NonNullable<LiveRoundData>['liveEntries']>[number];

interface Props {
	entries: LiveEntry[];
	eventId: string;
	dualChance: boolean;
	myName: string | null;
}

interface Group {
	key: string;
	number: number | null;
	chance: number;
	level: number;
	entries: LiveEntry[];
}

export default function ZktLiveStatus({entries, eventId, dualChance, myName}: Props) {
	const {t} = useTranslation();

	// The federation sends them in group, chance and station order already.
	const groups = useMemo(() => {
		const out: Group[] = [];
		for (const e of entries) {
			const key = `${e.groupNumber ?? 0}:${e.chance}`;
			let g = out.find((x) => x.key === key);
			if (!g) {
				g = {key, number: e.groupNumber ?? null, chance: e.chance, level: e.level, entries: []};
				out.push(g);
			}
			g.entries.push(e);
		}
		return out;
	}, [entries]);

	return (
		<div className={b('wca-live-status')}>
			<p className={b('wca-live-status-note')}>{t('zkt_comp.live_status_note')}</p>
			{groups.map((g) => (
				<section key={g.key} className={b('wca-live-status-group')}>
					<header className={b('wca-live-status-group-head')}>
						<span>
							{g.number != null && t('zkt_comp.live_group_n', {n: g.number})}
							{dualChance && ` · ${t('zkt_comp.chance_n', {n: g.chance})}`}
						</span>
						<span>
							{g.level > 0
								? t('zkt_comp.live_group_level', {n: g.level})
								: t('zkt_comp.live_group_level_none')}
						</span>
					</header>
					<ul className={b('wca-live-status-list')}>
						{g.entries.map((e) => {
							const isMe = !!myName && e.personName === myName;
							return (
								<li key={`${e.personLiveId}:${e.chance}`} className={b('wca-live-status-row', {me: isMe})}>
									<span className={b('wca-live-status-station')} title={t('zkt_comp.live_station')}>
										{e.station ?? ''}
									</span>
									<span className={b('wca-live-status-main')}>
										<span className={b('wca-live-status-name')}>
											{e.personName}
											{isMe && <span className={b('me-badge')}>{t('my_schedule.you')}</span>}
										</span>
										{e.attempts.length > 0 && (
											<span className={b('wca-live-status-times')}>
												{e.attempts.map((a, i) => (
													<span key={i} className={b('wca-live-status-time')}>
														{formatResult(a.result, eventId, false)}
													</span>
												))}
											</span>
										)}
									</span>
									<span className={b('wca-live-status-side')}>
										{e.official ? (
											<span className={b('wca-live-status-tag')}>{t('zkt_comp.live_official')}</span>
										) : e.noShow ? (
											<span className={b('wca-live-status-tag')}>{t('zkt_comp.live_no_show')}</span>
										) : (
											<span className={b('wca-live-status-progress')}>
												{e.done}/{e.expected}
											</span>
										)}
									</span>
								</li>
							);
						})}
					</ul>
				</section>
			))}
		</div>
	);
}
