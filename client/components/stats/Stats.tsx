import React, {createContext, useEffect, useMemo, useState} from 'react';
import {useHistory, useLocation} from 'react-router-dom';
import './Stats.scss';
import block from '../../styles/bem';
import {useSolveDb} from '../../util/hooks/useSolveDb';
import {useSessionDb} from '../../util/hooks/useSessionDb';
import {IDropdownOption} from '../common/inputs/dropdown/dropdown_option/DropdownOption';
import HeroBand from './common/hero_band/HeroBand';
import CubeStatHero from './cube_stats/cube_hero/CubeStatHero';
import CubeStats from './cube_stats/CubeStats';
import StatsFilterControls, {FilterChip} from './common/filter_controls/StatsFilterControls';
import {fetchAllCubeTypesSolved, FilterSolvesOptions, fetchSolves} from '../../db/solves/query';
import {fetchSessions} from '../../db/sessions/query';
import {getCubeTypeInfoById, getUniqueCubeTypes, getSubsetsForBuckets} from '../../util/cubes/util';
import {CubeType} from '../../util/cubes/cube_types';
import AllStats from './all/AllStats';
import {gql, useQuery} from '@apollo/client';
import {Stats as StatsSchema} from '../../@types/generated/graphql';
import {STATS_FRAGMENT} from '../../util/graphql/fragments';
import {useMe} from '../../util/hooks/useMe';
import {useGeneral} from '../../util/hooks/useGeneral';
import {useTranslation} from 'react-i18next';
import {StatsView} from './cube_stats/view_toggle/StatsViewToggle';

const b = block('stats');

const CUBE_TYPE_QUERY_PARAM = 'cubeType';
const SCRAMBLE_SUBSET_QUERY_PARAM = 'subset';
const SESSION_QUERY_PARAM = 'session';
const LAST_N_QUERY_PARAM = 'lastN';

export const LAST_N_OPTIONS = [12, 25, 50, 100, 500, 1000, 2000] as const;
const LAST_N_SET = new Set<number>(LAST_N_OPTIONS);

interface StatsQueryData {
	stats: StatsSchema;
}

export interface IStatsContext {
	all: boolean;
	cubeType: CubeType;
	stats: StatsSchema;
	filterOptions: FilterSolvesOptions;
	view: StatsView;
	setView: (view: StatsView) => void;
	smartLastN: number | null;
}

const STATS_QUERY = gql`
	${STATS_FRAGMENT}

	query Query {
		stats {
			...StatsFragment
		}
	}
`;

export const StatsContext = createContext<IStatsContext>(null);

export default function Stats() {
	const {t} = useTranslation();
	const me = useMe();
	const mobileMode = useGeneral('mobile_mode');

	const {data: statsData} = useQuery<StatsQueryData>(STATS_QUERY, {
		fetchPolicy: 'no-cache',
		skip: !me,
	});

	// useLocation (not window.location) — SSR-safe via StaticRouter and hydration-safe;
	// window is undefined during server render of this login-gated, SSR'd page.
	const {search} = useLocation();
	const urlParams = new URLSearchParams(search);
	const tabCubeType = urlParams.get(CUBE_TYPE_QUERY_PARAM);
	const tabSubset = urlParams.get(SCRAMBLE_SUBSET_QUERY_PARAM);
	const tabSession = urlParams.get(SESSION_QUERY_PARAM);
	const rawLastN = urlParams.get(LAST_N_QUERY_PARAM);
	const tabLastN = rawLastN && LAST_N_SET.has(Number(rawLastN)) ? Number(rawLastN) : null;

	// If lastN is in URL, user is targeting smart view — don't break the shared link.
	const [view, setView] = useState<StatsView>(tabLastN !== null ? 'smart' : 'all');

	const solveUpdate = useSolveDb();
	const sessionUpdate = useSessionDb();

	const cubeTypes = useMemo(() => {
		return fetchAllCubeTypesSolved();
	}, [solveUpdate]);

	const allSessions = useMemo(() => fetchSessions(), [sessionUpdate]);

	const history = useHistory();

	function buildStatsUrl(
		cube_type: string | null,
		scramble_subset?: string | null,
		session_id?: string | null,
		last_n?: number | null,
	) {
		const params = new URLSearchParams();
		if (cube_type) params.set(CUBE_TYPE_QUERY_PARAM, cube_type);
		if (scramble_subset != null) params.set(SCRAMBLE_SUBSET_QUERY_PARAM, scramble_subset);
		if (session_id) params.set(SESSION_QUERY_PARAM, session_id);
		if (last_n != null) params.set(LAST_N_QUERY_PARAM, String(last_n));
		const qs = params.toString();
		return qs ? `/stats?${qs}` : '/stats';
	}

	function navigateToBucket(cube_type: string | null, scramble_subset?: string | null) {
		if (!cube_type) {
			history.push(buildStatsUrl(null, null, tabSession, tabLastN));
			return;
		}
		// Empty string ('') is a valid subset id (777 WCA, 333 Random State) — only null/undefined
		// means "no subset selected".
		if (scramble_subset == null) {
			const subs = getSubsetsForBuckets(cube_type, cubeTypes);
			if (subs.length === 0) {
				history.push(buildStatsUrl(null, null, tabSession, tabLastN));
				return;
			}
			history.push(buildStatsUrl(cube_type, subs[0].id, tabSession, tabLastN));
			return;
		}
		history.push(buildStatsUrl(cube_type, scramble_subset, tabSession, tabLastN));
	}

	function navigateToSession(session_id: string | null) {
		history.push(buildStatsUrl(tabCubeType, tabSubset, session_id, tabLastN));
	}

	function navigateToLastN(last_n: number | null) {
		history.push(buildStatsUrl(tabCubeType, tabSubset, tabSession, last_n));
	}

	const uniqueCubeTypes = useMemo(() => getUniqueCubeTypes(cubeTypes), [cubeTypes]);
	const subsetsForCurrentCube = useMemo(() => {
		if (!tabCubeType) return [];
		return getSubsetsForBuckets(tabCubeType, cubeTypes);
	}, [tabCubeType, cubeTypes]);

	// When bucket changes, scroll to top — ScrollReset only watches pathname,
	// not triggered when query string changes (PuzzleCard click, dropdown selection).
	useEffect(() => {
		window.scrollTo({top: 0, left: 0, behavior: 'instant'} as ScrollToOptions);
	}, [tabCubeType, tabSubset]);

	// Old URL ('?cubeType=wca' without subset) → auto-redirect to first subset.
	// `subset=` empty string is default subset (e.g., 777 WCA, 333 Random State) — not null,
	// so redirect is not triggered.
	useEffect(() => {
		if (tabCubeType && tabSubset === null) {
			if (subsetsForCurrentCube.length > 0) {
				history.replace(buildStatsUrl(tabCubeType, subsetsForCurrentCube[0].id, tabSession, tabLastN));
			} else {
				history.replace(buildStatsUrl(null, null, tabSession, tabLastN));
			}
		}
	}, [tabCubeType, tabSubset, subsetsForCurrentCube, tabSession, tabLastN]);

	// When view changes from 'smart' to 'all', remove lastN from URL (smart-only selection).
	useEffect(() => {
		if (view !== 'smart' && tabLastN !== null) {
			history.replace(buildStatsUrl(tabCubeType, tabSubset, tabSession, null));
		}
	}, [view, tabLastN, tabCubeType, tabSubset, tabSession]);

	// "All" mode: no cubeType OR subset URL parameter never provided (null).
	// Empty string ('') is a valid subset id (777 WCA, 333 Random State, etc.).
	const all = !tabCubeType || tabSubset === null;
	const filterOptions: FilterSolvesOptions = {
		from_timer: true,
	};
	if (!all) {
		filterOptions.cube_type = tabCubeType;
		filterOptions.scramble_subset = tabSubset;
	}
	if (tabSession) {
		filterOptions.session_id = tabSession;
	}

	// Session dropdown: show sessions with solves for the selected bucket (cube_type+subset).
	// In "all" mode, show all sessions.
	const sessionsForCurrentBucket = useMemo(() => {
		if (all) return allSessions;
		const sessionFilter: any = { cube_type: tabCubeType };
		if (tabSubset != null) sessionFilter.scramble_subset = tabSubset;
		const solves = fetchSolves(sessionFilter);
		const sessionIdsWithData = new Set<string>();
		for (const s of solves) {
			if (s.session_id) sessionIdsWithData.add(s.session_id);
		}
		return allSessions.filter((s) => sessionIdsWithData.has(s.id));
	}, [allSessions, all, tabCubeType, tabSubset, solveUpdate]);

	const sessionDropdownText = useMemo(() => {
		if (!tabSession) return t('stats.all_sessions');
		const found = allSessions.find((s) => s.id === tabSession);
		return found?.name || t('stats.all_sessions');
	}, [tabSession, allSessions, t]);

	const sessionOptions: IDropdownOption[] = useMemo(() => {
		const opts: IDropdownOption[] = [
			{
				text: t('stats.all_sessions'),
				selected: !tabSession,
				onClick: () => navigateToSession(null),
			},
		];
		for (const s of sessionsForCurrentBucket) {
			opts.push({
				text: s.name,
				selected: tabSession === s.id,
				onClick: () => navigateToSession(s.id),
			});
		}
		return opts;
	}, [sessionsForCurrentBucket, tabSession, t]);

	const cubeDropdownText = tabCubeType
		? getCubeTypeInfoById(tabCubeType)?.name || tabCubeType
		: t('stats.select_cube');

	const cubeOptions: IDropdownOption[] = useMemo(() => {
		return uniqueCubeTypes.map((ct: CubeType | string) => {
			const id = typeof ct === 'string' ? ct : ct.id;
			const info = getCubeTypeInfoById(id);
			const label = info?.name || id;
			return {
				text: label,
				selected: tabCubeType === id,
				onClick: () => navigateToBucket(id),
			};
		});
	}, [uniqueCubeTypes, tabCubeType, cubeTypes]);

	const subsetDropdownText = useMemo(() => {
		if (!tabCubeType) return '';
		const found = subsetsForCurrentCube.find((s) => s.id === tabSubset);
		return found?.label || subsetsForCurrentCube[0]?.label || '';
	}, [tabCubeType, tabSubset, subsetsForCurrentCube]);

	const subsetOptions: IDropdownOption[] = useMemo(() => {
		return subsetsForCurrentCube.map((s) => ({
			text: s.label,
			selected: tabSubset === s.id,
			onClick: () => navigateToBucket(tabCubeType, s.id),
		}));
	}, [subsetsForCurrentCube, tabSubset, tabCubeType]);

	const context: IStatsContext = {
		all,
		cubeType: getCubeTypeInfoById(tabCubeType),
		filterOptions,
		stats: statsData?.stats || {},
		view,
		setView,
		smartLastN: tabLastN,
	};

	const lastNDropdownText = useMemo(() => {
		if (tabLastN == null) return t('stats.last_n.all');
		return t('stats.last_n.option', {value: tabLastN.toLocaleString()});
	}, [tabLastN, t]);

	const lastNOptions: IDropdownOption[] = useMemo(() => {
		const opts: IDropdownOption[] = [
			{
				text: t('stats.last_n.all'),
				selected: tabLastN == null,
				onClick: () => navigateToLastN(null),
			},
		];
		for (const n of LAST_N_OPTIONS) {
			opts.push({
				text: t('stats.last_n.option', {value: n.toLocaleString()}),
				selected: tabLastN === n,
				onClick: () => navigateToLastN(n),
			});
		}
		return opts;
	}, [tabLastN, t]);

	const cubeChip: FilterChip | null = uniqueCubeTypes.length > 0 ? {
		label: cubeDropdownText,
		options: cubeOptions,
		visible: true,
	} : null;

	const subsetChip: FilterChip | null = tabCubeType && subsetsForCurrentCube.length > 0 ? {
		label: subsetDropdownText,
		options: subsetOptions,
		visible: true,
	} : null;

	const sessionChip: FilterChip | null = sessionsForCurrentBucket.length > 0 ? {
		label: sessionDropdownText,
		options: sessionOptions,
		visible: true,
	} : null;

	// LastN chip only appears in smart view (cube selected AND user toggled smart).
	const lastNChip: FilterChip | null = !all && view === 'smart' ? {
		label: lastNDropdownText,
		options: lastNOptions,
		visible: true,
	} : null;

	const filtersBody = (
		<StatsFilterControls
			allMode={all}
			allLabel={t('stats.all')}
			onAllClick={() => navigateToBucket(null, null)}
			cubeChip={cubeChip}
			subsetChip={subsetChip}
			sessionChip={sessionChip}
			lastNChip={lastNChip}
		/>
	);

	// "All" view: on desktop hide HeroBand (title repeated), move filters to "Overview" title.
	// On mobile, HeroBand is preserved (location icon + embedded nav/avatar).
	// Cube view (CubeStatHero) carries info, so it never changes.
	return (
		<StatsContext.Provider value={context}>
			<div className={b()}>
				<div className={b('shell')}>
					{all ? (
						mobileMode ? (
							<HeroBand title={t('stats.hero.title')} subtitle={t('stats.hero.subtitle')}>
								{filtersBody}
							</HeroBand>
						) : null
					) : (
						<CubeStatHero>{filtersBody}</CubeStatHero>
					)}
					{/* Mode 2 (cube selected, subset null) no longer possible — to avoid empty render
					    in transient frame before auto-redirect: if subset not yet set, show AllStats. */}
					{all ? <AllStats filters={mobileMode ? null : filtersBody} /> : <CubeStats />}
				</div>
			</div>
		</StatsContext.Provider>
	);
}
