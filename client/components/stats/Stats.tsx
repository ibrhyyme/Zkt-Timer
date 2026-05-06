import React, {createContext, useEffect, useMemo} from 'react';
import {useHistory} from 'react-router-dom';
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
import {useTranslation} from 'react-i18next';

const b = block('stats');

const CUBE_TYPE_QUERY_PARAM = 'cubeType';
const SCRAMBLE_SUBSET_QUERY_PARAM = 'subset';
const SESSION_QUERY_PARAM = 'session';

interface StatsQueryData {
	stats: StatsSchema;
}

export interface IStatsContext {
	all: boolean;
	cubeType: CubeType;
	stats: StatsSchema;
	filterOptions: FilterSolvesOptions;
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

	const {data: statsData} = useQuery<StatsQueryData>(STATS_QUERY, {
		fetchPolicy: 'no-cache',
		skip: !me,
	});

	const urlParams = new URLSearchParams(window.location.search);
	const tabCubeType = urlParams.get(CUBE_TYPE_QUERY_PARAM);
	const tabSubset = urlParams.get(SCRAMBLE_SUBSET_QUERY_PARAM);
	const tabSession = urlParams.get(SESSION_QUERY_PARAM);

	const solveUpdate = useSolveDb();
	const sessionUpdate = useSessionDb();

	const cubeTypes = useMemo(() => {
		return fetchAllCubeTypesSolved();
	}, [solveUpdate]);

	const allSessions = useMemo(() => fetchSessions(), [sessionUpdate]);

	const history = useHistory();

	function buildStatsUrl(cube_type: string | null, scramble_subset?: string | null, session_id?: string | null) {
		const params = new URLSearchParams();
		if (cube_type) params.set(CUBE_TYPE_QUERY_PARAM, cube_type);
		if (scramble_subset != null) params.set(SCRAMBLE_SUBSET_QUERY_PARAM, scramble_subset);
		if (session_id) params.set(SESSION_QUERY_PARAM, session_id);
		const qs = params.toString();
		return qs ? `/stats?${qs}` : '/stats';
	}

	function navigateToBucket(cube_type: string | null, scramble_subset?: string | null) {
		if (!cube_type) {
			history.push(buildStatsUrl(null, null, tabSession));
			return;
		}
		// Bos string ('') gecerli bir subset id (777 WCA, 333 Random State) — sadece null/undefined
		// "subset secilmemis" anlamina gelir.
		if (scramble_subset == null) {
			const subs = getSubsetsForBuckets(cube_type, cubeTypes);
			if (subs.length === 0) {
				history.push(buildStatsUrl(null, null, tabSession));
				return;
			}
			history.push(buildStatsUrl(cube_type, subs[0].id, tabSession));
			return;
		}
		history.push(buildStatsUrl(cube_type, scramble_subset, tabSession));
	}

	function navigateToSession(session_id: string | null) {
		history.push(buildStatsUrl(tabCubeType, tabSubset, session_id));
	}

	const uniqueCubeTypes = useMemo(() => getUniqueCubeTypes(cubeTypes), [cubeTypes]);
	const subsetsForCurrentCube = useMemo(() => {
		if (!tabCubeType) return [];
		return getSubsetsForBuckets(tabCubeType, cubeTypes);
	}, [tabCubeType, cubeTypes]);

	// Bucket degisikliginde scroll'u tepeye al — ScrollReset sadece pathname'i izliyor,
	// query string degistiginde (PuzzleCard tiklamasi, dropdown secimi) tetiklenmiyor.
	useEffect(() => {
		window.scrollTo({top: 0, left: 0, behavior: 'instant'} as ScrollToOptions);
	}, [tabCubeType, tabSubset]);

	// Eski URL ('?cubeType=wca' subset'siz) → ilk subset'e otomatik yonlendir.
	// `subset=` bos string default subset (orn 777 WCA, 333 Random State) — null degil,
	// dolayisiyla redirect tetiklemez.
	useEffect(() => {
		if (tabCubeType && tabSubset === null) {
			if (subsetsForCurrentCube.length > 0) {
				history.replace(buildStatsUrl(tabCubeType, subsetsForCurrentCube[0].id, tabSession));
			} else {
				history.replace(buildStatsUrl(null, null, tabSession));
			}
		}
	}, [tabCubeType, tabSubset, subsetsForCurrentCube, tabSession]);

	// "Tumu" modu: cubeType yok VEYA subset URL parametresi hic verilmemis (null).
	// Bos string ('') gecerli bir subset id'si (777 WCA, 333 Random State, vb).
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

	// Sezon dropdown'u: secili bucket'a (cube_type+subset) solve'u olan sezonlari goster.
	// "Tumu" modunda tum sezonlari goster.
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

	// Mod 2 (cube secili, subset null) artik mumkun degil — auto-redirect oncesi gecici frame'de
	// "AllStats" yerine bos render'a dusmemek icin: subset henuz set olmadiysa AllStats goster.
	let body = <AllStats />;
	if (!all) {
		body = <CubeStats />;
	}

	const context: IStatsContext = {
		all,
		cubeType: getCubeTypeInfoById(tabCubeType),
		filterOptions,
		stats: statsData?.stats || {},
	};

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

	const filtersBody = (
		<StatsFilterControls
			allMode={all}
			allLabel={t('stats.all')}
			onAllClick={() => navigateToBucket(null, null)}
			cubeChip={cubeChip}
			subsetChip={subsetChip}
			sessionChip={sessionChip}
		/>
	);

	return (
		<StatsContext.Provider value={context}>
			<div className={b()}>
				<div className={b('shell')}>
					{all ? (
						<HeroBand title={t('stats.hero.title')} subtitle={t('stats.hero.subtitle')}>
							{filtersBody}
						</HeroBand>
					) : (
						<CubeStatHero>{filtersBody}</CubeStatHero>
					)}
					{body}
				</div>
			</div>
		</StatsContext.Provider>
	);
}
