import React, { createContext, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import './Stats.scss';
import block from '../../styles/bem';
import { useSolveDb } from '../../util/hooks/useSolveDb';
import PageTitle from '../common/page_title/PageTitle';
import Button from '../common/button/Button';
import CubePicker from '../common/cube_picker/CubePicker';
import SubsetPicker from '../timer/header_control/SubsetPicker';
import CubeStats from './cube_stats/CubeStats';
import { fetchAllCubeTypesSolved, FilterSolvesOptions } from '../../db/solves/query';
import { getCubeTypeInfoById, getUniqueCubeTypes, getSubsetsForBuckets } from '../../util/cubes/util';
import { CubeType } from '../../util/cubes/cube_types';
import AllStats from './all/AllStats';
import { gql, useQuery } from '@apollo/client';
import { Stats as StatsSchema } from '../../@types/generated/graphql';
import { STATS_FRAGMENT } from '../../util/graphql/fragments';
import { useMe } from '../../util/hooks/useMe';
import { useTranslation } from 'react-i18next';

const b = block('stats');

const CUBE_TYPE_QUERY_PARAM = 'cubeType';
const SCRAMBLE_SUBSET_QUERY_PARAM = 'subset';
const ALL_TAB_ID = 'all';
const ALL_SUBSETS_MARKER = '__all_subsets__';

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
	const { t } = useTranslation();
	const me = useMe();

	const { data: statsData } = useQuery<StatsQueryData>(STATS_QUERY, {
		fetchPolicy: 'no-cache',
		skip: !me,
	});

	const urlParams = new URLSearchParams(window.location.search);
	const tabCubeType = urlParams.get(CUBE_TYPE_QUERY_PARAM);
	const tabSubset = urlParams.get(SCRAMBLE_SUBSET_QUERY_PARAM);
	const tabId = tabCubeType ? `${tabCubeType}::${tabSubset ?? ''}` : ALL_TAB_ID;

	useSolveDb();


	const cubeTypes = useMemo(() => {
		return fetchAllCubeTypesSolved();
	}, []);

	const all = tabId === ALL_TAB_ID;
	const filterOptions: FilterSolvesOptions = {
		from_timer: true,
	};
	if (!all) {
		filterOptions.cube_type = tabCubeType;
		// URL'de subset param'i yoksa → "Hepsi" modu, subset filter ekleme
		// URL'de subset='' ise → '' subset (Random State gibi) → null filter
		// URL'de subset dolu ise → o subset
		if (tabSubset !== null) {
			filterOptions.scramble_subset = tabSubset || null;
		}
	}

	const history = useHistory();

	// navigateToBucket: null cube_type → /stats (hepsi)
	// scramble_subset undefined → URL'de subset param'i ekleme (Hepsi modu)
	// scramble_subset string (empty veya dolu) → URL'de subset=deger
	function navigateToBucket(cube_type: string | null, scramble_subset?: string) {
		if (!cube_type) {
			history.push('/stats');
			return;
		}
		if (scramble_subset === undefined) {
			history.push(`/stats?${CUBE_TYPE_QUERY_PARAM}=${cube_type}`);
			return;
		}
		history.push(`/stats?${CUBE_TYPE_QUERY_PARAM}=${cube_type}&${SCRAMBLE_SUBSET_QUERY_PARAM}=${scramble_subset}`);
	}

	const uniqueCubeTypes = useMemo(() => getUniqueCubeTypes(cubeTypes), [cubeTypes]);
	const subsetsForCurrentCube = useMemo(() => {
		if (!tabCubeType) return [];
		const subs = getSubsetsForBuckets(tabCubeType, cubeTypes);
		if (subs.length === 0) return [];
		return [{ id: ALL_SUBSETS_MARKER, label: t('stats.all') }, ...subs];
	}, [tabCubeType, cubeTypes, t]);

	function handleCubeTypeChange(ct: CubeType) {
		// Default olarak "Hepsi" — subset param URL'e eklenmez
		navigateToBucket(ct.id);
	}

	function handleSubsetChange(subset: string | null) {
		if (!tabCubeType) return;
		if (subset === ALL_SUBSETS_MARKER) {
			navigateToBucket(tabCubeType);
			return;
		}
		// SubsetPicker '' id'li subset icin null gonderir → URL'de subset='' olarak tutalim
		navigateToBucket(tabCubeType, subset ?? '');
	}

	let body = <AllStats />;
	if (tabId && tabId !== ALL_TAB_ID) {
		body = <CubeStats />;
	}

	const context: IStatsContext = {
		all,
		cubeType: getCubeTypeInfoById(tabCubeType),
		filterOptions,
		stats: statsData?.stats || {},
	};

	return (
		<StatsContext.Provider value={context}>
			<div className={b()}>
				<div className={b('shell')}>
					<PageTitle pageName={t('stats.page_title')} inline>
						<div className={b('filters')}>
							<Button
								text={t('stats.all')}
								onClick={() => navigateToBucket(null, null)}
								primary={all}
								transparent={!all}
								noMargin
							/>
							{!all && (
								<>
									<CubePicker
										value={tabCubeType || ''}
										cubeTypes={uniqueCubeTypes}
										onChange={handleCubeTypeChange}
										dropdownProps={{ openLeft: true }}
									/>
									<SubsetPicker
										subsets={subsetsForCurrentCube}
										selectedSubset={tabSubset === null ? ALL_SUBSETS_MARKER : tabSubset}
										onChange={handleSubsetChange}
									/>
								</>
							)}
							{all && uniqueCubeTypes.length > 0 && (
								<CubePicker
									value=""
									cubeTypes={uniqueCubeTypes}
									onChange={handleCubeTypeChange}
									dropdownProps={{ openLeft: true }}
								/>
							)}
						</div>
					</PageTitle>
					{body}
				</div>
			</div>
		</StatsContext.Provider>
	);
}
