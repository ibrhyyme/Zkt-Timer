import React, {createContext, useEffect, useMemo} from 'react';
import {useHistory} from 'react-router-dom';
import {CaretDown} from 'phosphor-react';
import './Stats.scss';
import block from '../../styles/bem';
import {useSolveDb} from '../../util/hooks/useSolveDb';
import Button from '../common/button/Button';
import Dropdown from '../common/inputs/dropdown/Dropdown';
import {IDropdownOption} from '../common/inputs/dropdown/dropdown_option/DropdownOption';
import HeroBand from './common/hero_band/HeroBand';
import CubeStatHero from './cube_stats/cube_hero/CubeStatHero';
import CubeStats from './cube_stats/CubeStats';
import {fetchAllCubeTypesSolved, FilterSolvesOptions} from '../../db/solves/query';
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
const ALL_TAB_ID = 'all';

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

	useSolveDb();

	const cubeTypes = useMemo(() => {
		return fetchAllCubeTypesSolved();
	}, []);

	const history = useHistory();

	function navigateToBucket(cube_type: string | null, scramble_subset?: string | null) {
		if (!cube_type) {
			history.push('/stats');
			return;
		}
		if (!scramble_subset) {
			// Subset zorunlu — ilk bucket'a auto-redirect
			const subs = getSubsetsForBuckets(cube_type, cubeTypes);
			if (subs.length === 0) {
				history.push('/stats');
				return;
			}
			history.push(`/stats?${CUBE_TYPE_QUERY_PARAM}=${cube_type}&${SCRAMBLE_SUBSET_QUERY_PARAM}=${subs[0].id}`);
			return;
		}
		history.push(`/stats?${CUBE_TYPE_QUERY_PARAM}=${cube_type}&${SCRAMBLE_SUBSET_QUERY_PARAM}=${scramble_subset}`);
	}

	const uniqueCubeTypes = useMemo(() => getUniqueCubeTypes(cubeTypes), [cubeTypes]);
	const subsetsForCurrentCube = useMemo(() => {
		if (!tabCubeType) return [];
		return getSubsetsForBuckets(tabCubeType, cubeTypes);
	}, [tabCubeType, cubeTypes]);

	// Eski URL ('?cubeType=wca' subset'siz) → ilk subset'e otomatik yonlendir
	useEffect(() => {
		if (tabCubeType && !tabSubset) {
			if (subsetsForCurrentCube.length > 0) {
				history.replace(
					`/stats?${CUBE_TYPE_QUERY_PARAM}=${tabCubeType}&${SCRAMBLE_SUBSET_QUERY_PARAM}=${subsetsForCurrentCube[0].id}`
				);
			} else {
				history.replace('/stats');
			}
		}
	}, [tabCubeType, tabSubset, subsetsForCurrentCube]);

	// "Tumu" modu: cubeType yok VEYA henuz subset set olmamis (eski URL redirect arasi).
	// Boylece auto-redirect bir frame surdugunde CubeStatHero/CubeStats yerine AllStats render edilir,
	// flicker engellenir.
	const all = !tabCubeType || !tabSubset;
	const filterOptions: FilterSolvesOptions = {
		from_timer: true,
	};
	if (!all) {
		filterOptions.cube_type = tabCubeType;
		filterOptions.scramble_subset = tabSubset;
	}

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

	const filtersBody = (
		<>
			<Button
				text={t('stats.all')}
				onClick={() => navigateToBucket(null, null)}
				primary={all}
				transparent={!all}
				noMargin
			/>
			{uniqueCubeTypes.length > 0 && (
				<Dropdown
					text={cubeDropdownText}
					icon={<CaretDown />}
					options={cubeOptions}
					openLeft
				/>
			)}
			{tabCubeType && subsetsForCurrentCube.length > 0 && (
				<Dropdown
					text={subsetDropdownText}
					icon={<CaretDown />}
					options={subsetOptions}
					openLeft
				/>
			)}
		</>
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
