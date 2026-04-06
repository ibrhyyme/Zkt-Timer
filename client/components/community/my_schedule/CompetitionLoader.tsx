import React, {createContext, useContext, useState, useEffect} from 'react';
import {gqlQueryTyped} from '../../api';
import {WcaCompetitionDetailDocument} from '../../../@types/generated/graphql';
import {b} from './shared';
import {resourceUri} from '../../../util/storage';
import {Info} from 'phosphor-react';
import {useTranslation} from 'react-i18next';

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
const CACHE_TTL = 15 * 60 * 1000; // 15 dakika
const detailCache = new Map<string, {data: any; ts: number}>();

function getCached(id: string): any | null {
	const entry = detailCache.get(id);
	if (!entry) return null;
	if (Date.now() - entry.ts > CACHE_TTL) {
		detailCache.delete(id);
		return null;
	}
	return entry.data;
}

interface CompetitionLoaderProps {
	competitionId: string;
	children: React.ReactNode;
}

export default function CompetitionLoader({competitionId, children}: CompetitionLoaderProps) {
	const {t} = useTranslation();
	const [detail, setDetail] = useState<any>(() => getCached(competitionId));
	const [loading, setLoading] = useState(!getCached(competitionId));
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const cached = getCached(competitionId);
		if (cached) {
			setDetail(cached);
			setLoading(false);
			setError(null);
			return;
		}

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
			<div className={b('loading')}>
				<img src={resourceUri('/images/zkt-logo.png')} alt="" className={b('loading-logo')} />
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
