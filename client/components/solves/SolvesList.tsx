import React, { ReactNode, useEffect, useState, useRef } from 'react';
import './Solves.scss';
import CubePicker from '../common/cube_picker/CubePicker';
import Empty from '../common/empty/Empty';
import { SortAscending, SortDescending, Share, Funnel, ListChecks, Trash, X, CheckSquare, Timer } from 'phosphor-react';
import SolveListRow from './solve_row/SolveListRow';
import Loading from '../common/loading/Loading';
import { numberWithCommas } from '../../util/strings/util';
import { fetchSolveCount, fetchSolves, FilterSolvesOptions, fetchSolve } from '../../db/solves/query'; // Added fetchSolve
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
import { deleteMultipleSolvesDb } from '../../db/solves/update'; // Import delete logic
import { convertTimeStringToSeconds } from '../../util/time';


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

	// Selection State
	const [isSelectionMode, setIsSelectionMode] = useState(false);
	const [selectedSolves, setSelectedSolves] = useState<Set<string>>(new Set());
	const [isDeleting, setIsDeleting] = useState(false);

	// Time Filter State
	const [showTimeFilter, setShowTimeFilter] = useState(false);
	const [minTime, setMinTime] = useState('');
	const [maxTime, setMaxTime] = useState('');
	const timeFilterRef = useRef<HTMLDivElement>(null);

	const solveCountText = `${numberWithCommas(totalResults)} solve${totalResults === 1 ? '' : 's'}`;

	useEffect(() => {
		const list = fetchSolvesWithFilter();
		const results = fetchSolveCount(getFinalFilter());
		const moreResults = page * PAGE_SIZE < results - PAGE_SIZE;

		setTotalResults(() => results);
		setMoreResults(() => moreResults);
		setSolves(() => list);
	}, [updateCount, cubeType, jsonStr(filters), page, sortBy, sortInverse, cubeType]);

	// Reset selection when filters change or mode closed
	useEffect(() => {
		if (!isSelectionMode) {
			setSelectedSolves(new Set());
		}
	}, [isSelectionMode, cubeType, jsonStr(filters)]);

	// Close time filter on outside click
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (timeFilterRef.current && !timeFilterRef.current.contains(event.target as Node)) {
				setShowTimeFilter(false);
			}
		}
		if (showTimeFilter) {
			document.addEventListener('mousedown', handleClickOutside);
		} else {
			document.removeEventListener('mousedown', handleClickOutside);
		}
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [showTimeFilter]);

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

	function applyTimeFilter() {
		const filt = { ...filters };

		const timeQuery: any = {};
		let hasCondition = false;

		if (minTime) {
			try {
				const { timeSeconds } = convertTimeStringToSeconds(minTime, false);
				timeQuery.$gte = timeSeconds;
				hasCondition = true;
			} catch (e) {
				// Ignore invalid input
			}
		}
		if (maxTime) {
			try {
				const { timeSeconds } = convertTimeStringToSeconds(maxTime, false);
				timeQuery.$lte = timeSeconds;
				hasCondition = true;
			} catch (e) {
				// Ignore invalid input
			}
		}

		if (hasCondition) {
			filt.time = timeQuery;
		} else {
			delete filt.time;
		}

		setFilters(filt);
		setPage(0);
		setShowTimeFilter(false);
	}

	function clearTimeFilter() {
		setMinTime('');
		setMaxTime('');
		const filt = { ...filters };
		delete filt.time;
		setFilters(filt);
		setPage(0);
		setShowTimeFilter(false);
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

	// Bulk Actions
	function toggleSelectionMode() {
		setIsSelectionMode(!isSelectionMode);
	}

	function toggleSelectSolve(id: string) {
		const newSet = new Set(selectedSolves);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		setSelectedSolves(newSet);
	}

	function selectAllVisible() {
		const newSet = new Set(selectedSolves);
		solves.forEach(s => newSet.add(s.id));
		setSelectedSolves(newSet);
	}

	function selectAllMatchingFilter() {
		const allMatching = fetchSolves(getFinalFilter()); // No limit
		const newSet = new Set<string>();
		allMatching.forEach((s: any) => newSet.add(s.id));
		setSelectedSolves(newSet);
	}

	function clearSelection() {
		setSelectedSolves(new Set());
	}

	async function deleteSelected() {
		if (selectedSolves.size === 0) return;

		setIsDeleting(true);
		// Convert IDs to Solve objects
		const solvesToDelete = Array.from(selectedSolves).map(id => fetchSolve(id)).filter(s => !!s);

		await deleteMultipleSolvesDb(solvesToDelete);

		setIsDeleting(false);
		setIsSelectionMode(false);
		setSelectedSolves(new Set());
	}

	let body: ReactNode;
	if (solves && solves.length) {
		body = solves.map((solve) => (
			<SolveListRow
				key={solve.id}
				solve={solve}
				selectionMode={isSelectionMode}
				isSelected={selectedSolves.has(solve.id)}
				onToggleSelect={() => toggleSelectSolve(solve.id)}
			/>
		));
	} else if (solves && !solves.length) {
		body = <Empty text="Hiçbir çözüm bulunamadı" />;
	} else {
		body = <Loading />;
	}

	const filterCount = Object.keys(filters).length;

	let filterText = 'Filtre';
	if (filterCount) {
		filterText = `${filterCount} filtre`;
	}

	const hasTimeFilter = !!filters.time;

	return (
		<div className={b()}>
			<PageTitle pageName="Çözümler" />

			<div className="w-full px-2 mx-auto flex max-w-2xl flex-col gap-2">
				<div className="w-full mb-2 flex flex-row flex-wrap items-center gap-2">
					{/* Bulk Selection Toolbar */}
					{isSelectionMode ? (
						<div className="flex items-center gap-2 w-full animate-in fade-in slide-in-from-top-2 duration-200 p-2 bg-blue-900/20 rounded-lg border border-blue-500/30">
							<Button
								onClick={selectAllMatchingFilter}
								text={`Tümünü Seç (${totalResults})`}
								icon={<CheckSquare weight="bold" />}
								small
							/>
							{selectedSolves.size > 0 && (
								<Button
									onClick={clearSelection}
									text="Temizle"
									gray
									small
								/>
							)}
							<div className="grow" />
							<span className="text-sm font-bold text-blue-200 mr-2">
								{selectedSolves.size} seçildi
							</span>
							<Button
								onClick={deleteSelected}
								text="Sil"
								theme={CommonType.DANGER}
								icon={<Trash weight="bold" />}
								disabled={selectedSolves.size === 0 || isDeleting}
								loading={isDeleting}
								small
							/>
							<Button
								onClick={toggleSelectionMode}
								icon={<X weight="bold" />}
								gray
								small
							/>
						</div>
					) : (
						// Standard Toolbar
						<>
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

							{/* Time Filter */}
							<div className="relative" ref={timeFilterRef}>
								<Button
									text={hasTimeFilter ? 'Süre Seçildi' : 'Süre'}
									icon={<Timer weight="bold" />}
									onClick={() => setShowTimeFilter(!showTimeFilter)}
									gray={!hasTimeFilter}
									theme={hasTimeFilter ? CommonType.PRIMARY : undefined}
								/>
								{showTimeFilter && (
									<div className="absolute top-full left-0 mt-2 z-50 bg-gray-800 border border-gray-700 shadow-xl rounded-lg p-3 min-w-[280px] flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-100">
										<div className="flex flex-col gap-1">
											<label className="text-xs text-gray-400 font-bold ml-1">En Az (örn: 700)</label>
											<input
												type="text"
												inputMode="numeric"
												placeholder="700 = 7.00"
												className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
												value={minTime}
												onChange={(e) => setMinTime(e.target.value)}
												onKeyDown={(e) => e.key === 'Enter' && applyTimeFilter()}
											/>
										</div>
										<div className="flex flex-col gap-1">
											<label className="text-xs text-gray-400 font-bold ml-1">En Çok (örn: 1152)</label>
											<input
												type="text"
												inputMode="numeric"
												placeholder="1152 = 11.52"
												className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
												value={maxTime}
												onChange={(e) => setMaxTime(e.target.value)}
												onKeyDown={(e) => e.key === 'Enter' && applyTimeFilter()}
											/>
										</div>
										<div className="h-[1px] bg-gray-700 my-1" />
										<div className="flex gap-2">
											<Button
												text="Temizle"
												gray
												small
												fullWidth
												onClick={clearTimeFilter}
											/>
											<Button
												text="Uygula"
												theme={CommonType.PRIMARY}
												small
												fullWidth
												onClick={applyTimeFilter}
											/>
										</div>
									</div>
								)}
							</div>

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
										onClick: toggleSortByOrder,
									},
								]}
							/>
							<Button disabled={!solves?.length} gray icon={<Share weight="bold" />} onClick={viewAsText} />
							<Button
								text="Düzenle"
								icon={<ListChecks weight="bold" />}
								onClick={toggleSelectionMode}
								disabled={!solves?.length}
							/>
							<div className="grow" />
							<ResultCount value={solveCountText} />
						</>
					)}
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
