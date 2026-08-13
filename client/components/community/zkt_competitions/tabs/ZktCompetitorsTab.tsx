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
	const [dayFilter, setDayFilter] = useState<string | null>(null);

	// Day-split competition: one filter above the list instead of a badge on every
	// row. The day is something you look for, not something you read on every name.
	const dayChips = useMemo(() => {
		const counts = new Map<string, number>();
		for (const c of detail.competitors || []) {
			if (!c.dayLabel) continue;
			counts.set(c.dayLabel, (counts.get(c.dayLabel) || 0) + 1);
		}
		if (counts.size < 2) return [];
		const ordered = (detail.days || [])
			.map((d: any) => d.label)
			.filter((label: string) => counts.has(label));
		for (const label of counts.keys()) {
			if (!ordered.includes(label)) ordered.push(label);
		}
		return ordered.map((label: string) => ({label, count: counts.get(label) || 0}));
	}, [detail.competitors, detail.days]);

	const filtered = useMemo(() => {
		let all = detail.competitors || [];
		if (dayFilter) {
			all = all.filter((c: any) => c.dayLabel === dayFilter);
		}
		const q = search.trim().toLowerCase();
		if (!q) return all;
		return all.filter((c: any) => {
			const extId = (competitorExtId(c) || '').toLowerCase();
			return competitorDisplayName(c).toLowerCase().includes(q) || extId.includes(q);
		});
	}, [detail.competitors, search, dayFilter]);

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

			{dayChips.length > 0 && (
				<div className={b('day-filter')}>
					<button
						className={b('day-chip', {active: dayFilter === null})}
						onClick={() => setDayFilter(null)}
					>
						{t('day_filter_all')}
						<span className={b('day-chip-count')}>{(detail.competitors || []).length}</span>
					</button>
					{dayChips.map((chip: any) => (
						<button
							key={chip.label}
							className={b('day-chip', {active: dayFilter === chip.label})}
							onClick={() => setDayFilter(dayFilter === chip.label ? null : chip.label)}
						>
							{chip.label}
							<span className={b('day-chip-count')}>{chip.count}</span>
						</button>
					))}
				</div>
			)}

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
								{/* No per-row day badge — the filter above carries that. */}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
