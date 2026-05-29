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
type SortKey =
	| 'lastSeenAt'
	| 'caseName'
	| 'count'
	| 'averageTime'
	| 'bestTime'
	| 'avgRecognition'
	| 'avgExecution'
	| 'avgTps'
	| 'avgTurns';

interface Props {
	type: CaseType;
	cubeType?: string | null;
	subset?: string | null;
	sessionId?: string | null;
	lastN?: number | null;
}

interface ColumnDef {
	key: SortKey;
	label: string;
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

function ClockIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="12" cy="12" r="9" />
			<polyline points="12 7 12 12 15 14" />
		</svg>
	);
}

function SortArrow({ desc }: { desc: boolean }) {
	return <span className={b('sort-arrow')}>{desc ? '↓' : '↑'}</span>;
}

export default function CaseStatsModal({ type, cubeType, subset, sessionId, lastN }: Props) {
	const { t } = useTranslation();
	const [sortKey, setSortKey] = useState<SortKey>('lastSeenAt');
	const [sortDesc, setSortDesc] = useState(true);
	const [, setPatternTick] = useState(0);

	// Load LL pattern data once (trainer infrastructure)
	useLLPatternsReady();

	const { data, loading } = useQuery<CaseStatsQuery, CaseStatsQueryVariables>(CaseStatsDocument, {
		variables: {
			type,
			cubeType: cubeType ?? undefined,
			subset: subset ?? undefined,
			sessionId: sessionId ?? undefined,
			lastN: lastN ?? undefined,
		},
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

	// For OLL, generate cache-miss cases at runtime. PLL now uses PLLArrowView
	// — LL pattern lookup not needed.
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
		// Default: caseName ascending, others descending (largest on top)
		setSortDesc(k !== 'caseName');
	}

	const columns: ColumnDef[] = [
		{ key: 'count', label: t('case_stats.col_count') },
		{ key: 'averageTime', label: t('case_stats.col_avg') },
		{ key: 'bestTime', label: t('case_stats.col_best') },
		{ key: 'avgRecognition', label: t('case_stats.col_recognition') },
		{ key: 'avgExecution', label: t('case_stats.col_execution') },
		{ key: 'avgTps', label: t('case_stats.col_tps') },
		{ key: 'avgTurns', label: t('case_stats.col_turns') },
	];

	// For OLL, use LLPatternView (top U=white/X). For PLL, custom
	// PLLArrowView — top yellow + side strip colors + permutation arrows.
	const stickering = 'oll';

	return (
		<div className={b()}>
			<div className={b('header-row')}>
				<div className={b('header-preview')} aria-hidden="true" />
				<div className={b('header-name-cell')}>
					<button
						type="button"
						className={b('header-clock', { active: sortKey === 'lastSeenAt' })}
						onClick={() => toggleSort('lastSeenAt')}
						title={t('case_stats.sort_recent')}
						aria-label={t('case_stats.sort_recent')}
					>
						<ClockIcon />
						{sortKey === 'lastSeenAt' && <SortArrow desc={sortDesc} />}
					</button>
					<button
						type="button"
						className={b('header-cell', { active: sortKey === 'caseName', name: true })}
						onClick={() => toggleSort('caseName')}
					>
						<span>{t('case_stats.col_case')}</span>
						{sortKey === 'caseName' && <SortArrow desc={sortDesc} />}
					</button>
				</div>
				{columns.map((col) => (
					<button
						key={col.key}
						type="button"
						className={b('header-cell', { active: sortKey === col.key })}
						onClick={() => toggleSort(col.key)}
					>
						<span>{col.label}</span>
						{sortKey === col.key && <SortArrow desc={sortDesc} />}
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
							<div key={r.caseKey} className={b('row')}>
								<div className={b('row-preview')}>
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
										<div className={b('row-preview-placeholder')} />
									)}
								</div>
								<div className={b('row-name')} title={r.caseName || ''}>
									{shortName(type, r.caseKey || '', r.caseName || '')}
								</div>
								<div className={b('row-cell')}>{r.count ?? 0}</div>
								<div className={b('row-cell')}>{`${fmt(r.averageTime)}s`}</div>
								<div className={b('row-cell')}>{`${fmt(r.bestTime)}s`}</div>
								<div className={b('row-cell')}>{`${fmt(r.avgRecognition)}s`}</div>
								<div className={b('row-cell')}>{`${fmt(r.avgExecution)}s`}</div>
								<div className={b('row-cell')}>{fmt(r.avgTps)}</div>
								<div className={b('row-cell')}>{fmtInt(r.avgTurns)}</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
