import React, {createContext, useContext, useState, useEffect, useCallback} from 'react';
import {gqlQueryTyped} from '../../api';
import {
	WcaCompetitionDetailDocument,
	MyCompetitionFollowsDocument,
} from '../../../@types/generated/graphql';
import {b} from './shared';
import {resourceUri} from '../../../util/storage';
import {Info} from 'phosphor-react';
import {useTranslation} from 'react-i18next';
import {prefetchWcaLiveOverview} from './useLiveResults';
import {useMe} from '../../../util/hooks/useMe';
import {isPro} from '../../../lib/pro';

interface FollowEntry {
	id: string;
	followed_registrant_id: number;
	followed_wca_id?: string | null;
	followed_name: string;
}

interface CompetitionData {
	detail: any;
	loading: boolean;
	error: string | null;
	follows: FollowEntry[];
	followedIds: Set<number>;
	refetchFollows: () => Promise<void>;
	isFinished: boolean;
}

// Yarisma bitti mi? schedule dizisinin son gunu bugunden once mi?
function isCompetitionFinished(detail: any): boolean {
	if (!detail?.schedule || !Array.isArray(detail.schedule) || detail.schedule.length === 0) {
		return false; // veri yoksa "bitmis" demek hatali olur, izin ver
	}
	const dates = detail.schedule
		.map((d: any) => d?.date)
		.filter((d: any) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d));
	if (dates.length === 0) return false;
	const lastDate = dates.sort()[dates.length - 1];
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const cutoff = new Date(lastDate + 'T00:00:00');
	cutoff.setDate(cutoff.getDate() + 1); // son gunden bir gun sonrasi 00:00 — o ana kadar aktif say
	return today >= cutoff;
}

const CompetitionDataContext = createContext<CompetitionData | null>(null);

export function useCompetitionData(): CompetitionData {
	const ctx = useContext(CompetitionDataContext);
	if (!ctx) throw new Error('useCompetitionData must be used within CompetitionLoader');
	return ctx;
}

// Module-level cache - component unmount olsa bile veri korunur
// SWR pattern: stale veriyi hemen goster, arka planda yenile
const FRESH_TTL = 0; // her zaman background refetch (stale veriyi aninda goster)
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
	const me = useMe();
	const initialCached = getCached(competitionId);
	const [detail, setDetail] = useState<any>(initialCached?.data || null);
	const [loading, setLoading] = useState(!initialCached);
	const [error, setError] = useState<string | null>(null);
	const [follows, setFollows] = useState<FollowEntry[]>([]);

	const refetchFollows = useCallback(async () => {
		if (!me || !isPro(me)) {
			setFollows([]);
			return;
		}
		try {
			const res = await gqlQueryTyped(
				MyCompetitionFollowsDocument,
				{competitionId},
				{fetchPolicy: 'no-cache'},
			);
			const data = (res.data as any)?.myCompetitionFollows;
			setFollows(Array.isArray(data) ? data : []);
		} catch {
			// sessizce gec — Pro olmayanda da bos liste OK
		}
	}, [competitionId, me]);

	useEffect(() => {
		refetchFollows();
	}, [refetchFollows]);

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

	// Kullanici uygulamaya geri dondugunde (arka plandan one alma) sessizce yenile
	useEffect(() => {
		const handleVisibility = () => {
			if (document.visibilityState !== 'visible') return;
			const cached = getCached(competitionId);
			if (!cached) return;
			gqlQueryTyped(WcaCompetitionDetailDocument, {input: {competitionId}}, {fetchPolicy: 'no-cache'})
				.then((res) => {
					const data = res.data?.wcaCompetitionDetail;
					if (data) {
						detailCache.set(competitionId, {data, ts: Date.now()});
						setDetail(data);
					}
				})
				.catch(() => {});
		};
		document.addEventListener('visibilitychange', handleVisibility);
		return () => document.removeEventListener('visibilitychange', handleVisibility);
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

	const followedIds = new Set<number>(follows.map((f) => f.followed_registrant_id));
	const isFinished = isCompetitionFinished(detail);

	return (
		<CompetitionDataContext.Provider
			value={{detail, loading, error, follows, followedIds, refetchFollows, isFinished}}
		>
			{children}
		</CompetitionDataContext.Provider>
	);
}
