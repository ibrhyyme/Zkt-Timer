import React, { ReactNode, useEffect, useState } from 'react';
import './Solves.scss';
import CubePicker from '../common/cube_picker/CubePicker';
import Empty from '../common/empty/Empty';
import { SortAscending, SortDescending, Share, Funnel } from 'phosphor-react';
import SolveListRow from './solve_row/SolveListRow';
import Loading from '../common/loading/Loading';
import { numberWithCommas } from '../../util/strings/util';
import { fetchSolveCount, fetchSolves, FilterSolvesOptions } from '../../db/solves/query';
import { useSolveDb } from '../../util/hooks/useSolveDb';
import jsonStr from 'json-stable-stringify';
import { CubeType } from '../../util/cubes/cube_types';
import Button, { CommonType } from '../common/button/Button';
import Dropdown from '../common/inputs/dropdown/Dropdown';
import { IDropdownOption } from '../common/inputs/dropdown/dropdown_option/DropdownOption';
import block from '../../styles/bem';
import { openModal } from '../../actions/general';
import HistoryModal from '../modules/history/history_modal/HistoryModal';
import { useDispatch } from 'react-redux';
import { useMe } from '../../util/hooks/useMe';
import PageTitle from '../common/page_title/PageTitle';
import { LokiFetchOptions } from '../../db/lokijs';
import { Solve } from '../../../server/schemas/Solve.schema';
import ResultCount from '../common/result_count/ResultCount';


const PAGE_SIZE = 25;

const b = block('solves-list');

export default function SolvesList() {
	const dispatch = useDispatch();
	const me = useMe();

	const [cubeType, setCubeType] = useState('333');
	const [page, setPage] = useState(0);
	const [moreResults, setMoreResults] = useState(true);
	const [totalResults, setTotalResults] = useState(0);
	const [sortBy, setSortBy] = useState<keyof Solve>('started_at');
	const [sortInverse, setSortInverse] = useState(false);
	const [solves, setSolves] = useState<Solve[]>([]);
	const [filters, setFilters] = useState<FilterSolvesOptions>({});
	const updateCount = useSolveDb();

	const solveCountText = `${numberWithCommas(totalResults)} solve${totalResults === 1 ? '' : 's'}`;

	useEffect(() => {
		const list = fetchSolvesWithFilter();
		const results = fetchSolveCount(getFinalFilter());
		const moreResults = page * PAGE_SIZE < results - PAGE_SIZE;

		setTotalResults(() => results);
		setMoreResults(() => moreResults);
		setSolves(() => list);
	}, [updateCount, cubeType, jsonStr(filters), page, sortBy, sortInverse, cubeType]);

	function fetchSolvesWithFilter(removeLimit: boolean = false) {
		const finalFilter = getFinalFilter();

		const options: LokiFetchOptions = {
			sortBy,
			sortInverse: !sortInverse,
		};

		if (!removeLimit) {
			options.offset = page * PAGE_SIZE;
			options.limit = PAGE_SIZE;
		}

		return fetchSolves(finalFilter, options) as any;
	}

	function getFinalFilter(): FilterSolvesOptions {
		return {
			...filters,
			from_timer: true,
			cube_type: cubeType,
		};
	}

	function nextPage() {
		if (!moreResults) return;
		setPage(page + 1);
		window.scrollTo(0, 0);
	}

	function prevPage() {
		if (!page) return;
		setPage(page - 1);
		window.scrollTo(0, 0);
	}

	function toggleFilter(name: string, not: boolean = false) {
		const filt = { ...filters };
		const currentValue = filt[name];

		if ((currentValue === false && not) || (currentValue === true && !not)) {
			delete filt[name];
		} else if (currentValue === undefined) {
			filt[name] = !not;
		} else {
			filt[name] = !currentValue;
		}

		setFilters(filt);
	}

	function changeCubeType(cubeType: CubeType) {
		setPage(0);
		setCubeType(cubeType.id);
		filters.cube_type = cubeType.id;
	}

	function changeSortBy(value: keyof Solve) {
		setSortBy(value);
	}

	function toggleSortByOrder() {
		setSortInverse(!sortInverse);
	}

	function viewAsText() {
		const list = fetchSolvesWithFilter(true);

		const byUser = me ? ` by ${me?.username}` : '';

		dispatch(openModal(<HistoryModal showAsText description={`${solveCountText}${byUser}`} solves={list} />));
	}

	function getFilterOptionValue(name: string, key: keyof Solve, not?: boolean): IDropdownOption {
		const filterVal = filters[key];
		let currentValue;

		if (not) {
			currentValue = filterVal === false;
		} else {
			currentValue = filterVal === true;
		}

		return {
			checkbox: true,
			text: name,
			on: currentValue,
			onChange: () => toggleFilter(key, not),
		};
	}

	let body: ReactNode;
	if (solves && solves.length) {
		body = solves.map((solve) => <SolveListRow key={solve.id} solve={solve} />);
	} else if (solves && !solves.length) {
		body = <Empty text="Hiçbir çözüm bulunamadı" />;
	} else {
		body = <Loading />;
	}

	const filterCount = Object.keys(filters).length;

	let filterText = 'Filter';
	if (filterCount) {
		filterText = `${filterCount} filter${filterCount === 1 ? '' : 's'}`;
	}

	return (
		<div className={b()}>
			<PageTitle pageName="Çözümler" />

			<div className="w-full px-2 mx-auto flex max-w-2xl flex-col gap-2">
				<div className="w-full mb-2 flex flex-row flex-wrap items-center gap-2">
					<CubePicker
						dropdownProps={{
							openLeft: true,
						}}
						value={cubeType}
						onChange={changeCubeType}
					/>
					<Dropdown
						openLeft
						preventCloseOnInnerClick
						text={filterText}
						icon={<Funnel weight="bold" />}
						options={[
							getFilterOptionValue('Sadece +2', 'plus_two'),
							getFilterOptionValue('+2 Yok', 'plus_two', true),
							getFilterOptionValue('Sadece DNF', 'dnf'),
							getFilterOptionValue('DNF Yok', 'dnf', true),
							getFilterOptionValue('İçe Aktarılan', 'bulk'),
							getFilterOptionValue('İçe Aktarılmayan', 'bulk', true),
							getFilterOptionValue('Akıllı Küp', 'is_smart_cube'),
							getFilterOptionValue('Akıllı Küp Değil', 'is_smart_cube', true),
						]}
					/>
					<Dropdown
						text="Sırala"
						openLeft
						preventCloseOnInnerClick
						icon={sortInverse ? <SortAscending weight="bold" /> : <SortDescending weight="bold" />}
						options={[
							{
								text: 'Tarih',
								checkbox: true,
								on: sortBy === 'started_at',
								onChange: () => changeSortBy('started_at'),
							},
							{
								text: 'Süre',
								checkbox: true,
								on: sortBy === 'time',
								onChange: () => changeSortBy('time'),
							},
							{
								text: 'Ters Sıra',
								icon: sortInverse ? <SortDescending weight="bold" /> : <SortAscending weight="bold" />,
								// checkbox: true,
								// on: sortInverse,
								onClick: toggleSortByOrder,
							},
						]}
					/>
					<Button disabled={!solves?.length} gray icon={<Share weight="bold" />} onClick={viewAsText} />
					<div className="grow" />
					<ResultCount value={solveCountText} />
				</div>

				<div className={b('list')}>{body}</div>
				<div className={b('pagination')}>
					<Button
						onClick={prevPage}
						text="Önceki"
						disabled={page === 0}
						theme={page > 0 ? CommonType.PRIMARY : null}
					/>
					<p>
						Sayfa {page + 1} / {Math.ceil(totalResults / 25) || 1}
					</p>
					<Button
						onClick={nextPage}
						text="Sonraki"
						disabled={!moreResults}
						theme={page > 0 ? CommonType.PRIMARY : null}
					/>
				</div>
			</div>
		</div>
	);
}
