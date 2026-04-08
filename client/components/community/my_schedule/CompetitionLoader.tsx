import React, {createContext, useContext, useState, useEffect} from 'react';
import {gqlQueryTyped} from '../../api';
import {WcaCompetitionDetailDocument} from '../../../@types/generated/graphql';
import {b} from './shared';
import {resourceUri} from '../../../util/storage';
import {Info} from 'phosphor-react';
import {useTranslation} from 'react-i18next';
import {prefetchWcaLiveOverview} from './useLiveResults';

interface CompetitionData {
	detail: any;
	loading: boolean;
	error: string | null;
}

const CompetitionDataContext = createContext<CompetitionData | null>(null);

export function useCompetitionData(): CompetitionData {
	const ctx = useContext(CompetitionDataContext);
	if (!ctx) throw new Error('useCompetitionData must be used within CompetitionLoader');
	return ctx;
}

// Module-level cache - component unmount olsa bile veri korunur
// SWR pattern: stale veriyi hemen goster, arka planda yenile
const FRESH_TTL = 60 * 60 * 1000; // 1 saat — fresh
const STALE_TTL = 24 * 60 * 60 * 1000; // 24 saat — stale-but-show
const detailCache = new Map<string, {data: any; ts: number}>();

function getCached(id: string): {data: any; isStale: boolean} | null {
	const entry = detailCache.get(id);
	if (!entry) return null;
	const age = Date.now() - entry.ts;
	if (age > STALE_TTL) {
		detailCache.delete(id);
		return null;
	}
	return {data: entry.data, isStale: age > FRESH_TTL};
}

interface CompetitionLoaderProps {
	competitionId: string;
	children: React.ReactNode;
}

// Background prefetch helper — disaridan cagrilabilir (liste/hover prefetch icin)
export function prefetchCompetitionDetail(competitionId: string): void {
	const cached = getCached(competitionId);
	if (cached && !cached.isStale) return; // taze, gerek yok

	gqlQueryTyped(WcaCompetitionDetailDocument, {input: {competitionId}}, {fetchPolicy: 'no-cache'})
		.then((res) => {
			const data = res.data?.wcaCompetitionDetail;
			if (data) detailCache.set(competitionId, {data, ts: Date.now()});
		})
		.catch(() => {});
}

export default function CompetitionLoader({competitionId, children}: CompetitionLoaderProps) {
	const {t} = useTranslation();
	const initialCached = getCached(competitionId);
	const [detail, setDetail] = useState<any>(initialCached?.data || null);
	const [loading, setLoading] = useState(!initialCached);
	const [error, setError] = useState<string | null>(null);

	// WCA Live overview prefetch — detail geldiginde sessizce arka planda yukle
	useEffect(() => {
		if (detail?.wcaLiveCompId) {
			prefetchWcaLiveOverview(competitionId).catch(() => {});
		}
	}, [detail?.wcaLiveCompId, competitionId]);

	useEffect(() => {
		const cached = getCached(competitionId);

		// Cache'de var (fresh veya stale) → hemen goster
		if (cached) {
			setDetail(cached.data);
			setLoading(false);
			setError(null);

			// Stale ise arka planda sessizce yenile
			if (cached.isStale) {
				gqlQueryTyped(WcaCompetitionDetailDocument, {input: {competitionId}}, {fetchPolicy: 'no-cache'})
					.then((res) => {
						const data = res.data?.wcaCompetitionDetail;
						if (data) {
							detailCache.set(competitionId, {data, ts: Date.now()});
							setDetail(data);
						}
					})
					.catch(() => {});
			}
			return;
		}

		// Cache'de yok → loading goster, fetch et
		let cancelled = false;
		setLoading(true);
		setError(null);
		setDetail(null);

		gqlQueryTyped(WcaCompetitionDetailDocument, {input: {competitionId}}, {fetchPolicy: 'no-cache'})
			.then((res) => {
				if (cancelled) return;
				const data = res.data?.wcaCompetitionDetail;
				if (!data) {
					setError('no_wcif');
				} else {
					detailCache.set(competitionId, {data, ts: Date.now()});
					setDetail(data);
				}
			})
			.catch(() => {
				if (!cancelled) setError('fetch_error');
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [competitionId]);

	if (loading) {
		return (
			<div className={b('wca-loading')}>
				<img src={resourceUri('/images/logos/wca_logo.svg')} alt="WCA" className={b('wca-loading-logo')} />
				<div className={b('wca-loading-bar')}>
					<div className={b('wca-loading-bar-fill')} />
				</div>
				<span className={b('wca-loading-text')}>{t('my_schedule.loading')}</span>
			</div>
		);
	}

	if (error) {
		return (
			<div className={b('info-banner')}>
				<Info size={20} />
				<span>{t(`my_schedule.${error}`)}</span>
			</div>
		);
	}

	return (
		<CompetitionDataContext.Provider value={{detail, loading, error}}>
			{children}
		</CompetitionDataContext.Provider>
	);
}
