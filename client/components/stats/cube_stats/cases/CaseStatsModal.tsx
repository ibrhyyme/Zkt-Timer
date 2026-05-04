import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@apollo/client';
import './CaseStatsModal.scss';
import block from '../../../../styles/bem';
import { CaseStatsDocument, CaseStatsQuery, CaseStatsQueryVariables } from '../../../../@types/generated/graphql';
import LLPatternView from '../../../trainer/panels/LLPatternView';
import PLLArrowView from './PLLArrowView';
import { pllNameFromCaseName } from './pll_arrow_data';
import { ensureCasePattern, getCasePattern } from './case_pattern';
import { useLLPatternsReady } from '../../../../util/trainer/ll_patterns';

const b = block('case-stats-modal');

type CaseType = 'oll' | 'pll';
type SortKey = 'lastSeenAt' | 'caseName' | 'count' | 'averageTime' | 'avgRecognition' | 'avgExecution' | 'avgTps' | 'avgTurns';

interface Props {
	type: CaseType;
}

function compareName(a: string, b: string): number {
	const an = parseFloat(a);
	const bn = parseFloat(b);
	const aIsNum = !isNaN(an) && /^\d/.test(a);
	const bIsNum = !isNaN(bn) && /^\d/.test(b);
	if (aIsNum && bIsNum) return an - bn;
	return a.localeCompare(b);
}

function fmt(s: number | null | undefined): string {
	if (s == null || !isFinite(s)) return '-';
	return s.toFixed(2);
}

function fmtInt(s: number | null | undefined): string {
	if (s == null || !isFinite(s)) return '-';
	return String(Math.round(s));
}

function shortName(type: CaseType, caseKey: string, fallback: string): string {
	if (type === 'oll') {
		const m = caseKey.match(/(\d+)$/);
		return m ? `OLL ${m[1]}` : fallback;
	}
	return fallback;
}

interface StatProps {
	label: string;
	value: string | number;
}

function Stat({ label, value }: StatProps) {
	return (
		<div className={block('case-stats-modal')('card-stat')}>
			<div className={block('case-stats-modal')('card-stat-label')}>{label}</div>
			<div className={block('case-stats-modal')('card-stat-value')}>{value}</div>
		</div>
	);
}

export default function CaseStatsModal({ type }: Props) {
	const { t } = useTranslation();
	const [sortKey, setSortKey] = useState<SortKey>('lastSeenAt');
	const [sortDesc, setSortDesc] = useState(true);
	const [, setPatternTick] = useState(0);

	// LL pattern verisini bir kere yukle (trainer altyapisi)
	useLLPatternsReady();

	const { data, loading } = useQuery<CaseStatsQuery, CaseStatsQueryVariables>(CaseStatsDocument, {
		variables: { type },
		fetchPolicy: 'cache-and-network',
	});

	const rows = useMemo(() => {
		const list = (data?.caseStats || []).slice();
		list.sort((a, b) => {
			if (sortKey === 'caseName') {
				const cmp = compareName(a.caseName || '', b.caseName || '');
				return sortDesc ? -cmp : cmp;
			}
			const av = (a as any)[sortKey] ?? 0;
			const bv = (b as any)[sortKey] ?? 0;
			return sortDesc ? bv - av : av - bv;
		});
		return list;
	}, [data, sortKey, sortDesc]);

	// OLL icin cache miss case'leri runtime'da uret. PLL artik PLLArrowView
	// kullaniyor — LL pattern lookup gerekmiyor.
	useEffect(() => {
		if (type !== 'oll' || !rows.length) return;
		let cancelled = false;
		(async () => {
			for (const r of rows) {
				if (cancelled) return;
				if (!getCasePattern(type, r.caseKey || '')) {
					await ensureCasePattern(type, r.caseKey || '');
					if (!cancelled) setPatternTick((tick) => tick + 1);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [rows, type]);

	function toggleSort(k: SortKey) {
		if (sortKey === k) {
			setSortDesc(!sortDesc);
			return;
		}
		setSortKey(k);
		// Default: caseName ascending, geri kalan descending (en buyuk ustte)
		setSortDesc(k !== 'caseName');
	}

	const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
		{ key: 'lastSeenAt', label: t('case_stats.sort_recent') },
		{ key: 'caseName', label: t('case_stats.col_case') },
		{ key: 'count', label: t('case_stats.col_count') },
		{ key: 'averageTime', label: t('case_stats.col_avg') },
		{ key: 'avgRecognition', label: t('case_stats.col_recognition') },
		{ key: 'avgExecution', label: t('case_stats.col_execution') },
		{ key: 'avgTps', label: t('case_stats.col_tps') },
		{ key: 'avgTurns', label: t('case_stats.col_turns') },
	];

	// OLL icin LLPatternView kullaniyoruz (top U=beyaz/X). PLL icin custom
	// PLLArrowView — top sari + yan strip renkli + permutasyon ok'lari.
	const stickering = 'oll';

	return (
		<div className={b()}>
			<div className={b('sort-bar')}>
				<span className={b('sort-label')}>{t('case_stats.sort_by')}</span>
				{SORT_OPTIONS.map((opt) => (
					<button
						key={opt.key}
						type="button"
						className={b('sort-chip', { active: sortKey === opt.key })}
						onClick={() => toggleSort(opt.key)}
					>
						{opt.label}
						{sortKey === opt.key && (
							<span className={b('sort-arrow')}>{sortDesc ? ' ↓' : ' ↑'}</span>
						)}
					</button>
				))}
			</div>

			{loading && rows.length === 0 ? (
				<div className={b('exception')}>{t('case_stats.loading')}</div>
			) : rows.length === 0 ? (
				<div className={b('exception')}>{t('case_stats.empty_state')}</div>
			) : (
				<div className={b('list')}>
					{rows.map((r) => {
						const pllKey = type === 'pll' ? pllNameFromCaseName(r.caseName || '') : null;
						const pattern = type === 'oll' ? getCasePattern(type, r.caseKey || '') : '';
						return (
							<div key={r.caseKey} className={b('card')}>
								<div className={b('card-preview')}>
									{type === 'pll' && pllKey ? (
										<PLLArrowView pllKey={pllKey} size={72} />
									) : pattern ? (
										<LLPatternView
											pattern={pattern}
											topFace="U"
											frontFace="F"
											stickering={stickering}
											size={72}
										/>
									) : (
										<div className={b('card-preview-placeholder')} />
									)}
								</div>
								<div className={b('card-main')}>
									<div className={b('card-name')} title={r.caseName || ''}>
										{shortName(type, r.caseKey || '', r.caseName || '')}
									</div>
									<div className={b('card-values')}>
										<Stat label={t('case_stats.col_count')} value={r.count ?? 0} />
										<Stat label={t('case_stats.col_avg')} value={`${fmt(r.averageTime)}s`} />
										<Stat label={t('case_stats.col_best')} value={`${fmt(r.bestTime)}s`} />
										<Stat label={t('case_stats.col_recognition')} value={`${fmt(r.avgRecognition)}s`} />
										<Stat label={t('case_stats.col_execution')} value={`${fmt(r.avgExecution)}s`} />
										<Stat label={t('case_stats.col_tps')} value={fmt(r.avgTps)} />
										<Stat label={t('case_stats.col_turns')} value={fmtInt(r.avgTurns)} />
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
