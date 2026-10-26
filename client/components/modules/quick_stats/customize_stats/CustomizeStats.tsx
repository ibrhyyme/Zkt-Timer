import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RootStateOrAny, useDispatch, useSelector } from 'react-redux';
import { SortableContainer, SortableElement, SortableHandle } from 'react-sortable-hoc';
import { DotsSixVertical, Plus } from 'phosphor-react';
import jsonStr from 'json-stable-stringify';
import Button from '../../../common/button/Button';
import CustomizeStatsEditor from './CustomizeStatsEditor';
import { StatsModuleBlock } from '../../../../../server/schemas/StatsModule.schema';
import {
	addStatsModuleBlock,
	moveStatsModuleBlock,
	removeStatsModuleBlock,
	resetStatsModuleBlocks,
	updateStatsModuleBlock,
} from '../../../../actions/stats';
import { defaultStatsModuleBlocks } from '../../../../reducers/stats';
import { toastError } from '../../../../util/toast';
import { FilterSolvesOptions } from '../../../../db/solves/query';
import { useSolveDb } from '../../../../util/hooks/useSolveDb';
import { useActiveSessionId } from '../../../../util/hooks/useActiveSessionId';
import { useGeneral } from '../../../../util/hooks/useGeneral';
import { formatStatsBlockValue, getStatsBlockValueFromFilter, saveStatsModuleBlocks } from '../util';
import { getStatLabel } from '../stat_label';
import { MAX_STATS_BLOCKS } from '../block_options';
import block from '../../../../styles/bem';
import './CustomizeStats.scss';

const b = block('customize-stats');

// Edits land in the store at once (the module behind the modal follows live); the server
// write waits for a pause, so dragging through the count chips sends one request.
const SAVE_DELAY_MS = 400;

const DragHandle = SortableHandle<{ label: string }>(({ label }: { label: string }) => (
	<span className={b('handle')} aria-label={label} title={label}>
		<DotsSixVertical weight="bold" />
	</span>
));

interface RowProps {
	caption: string;
	value: string;
	selected: boolean;
	reorderLabel: string;
	onSelect: () => void;
}

const SortableRow = SortableElement<RowProps>(({ caption, value, selected, reorderLabel, onSelect }: RowProps) => (
	<li className={b('row', { selected })}>
		<DragHandle label={reorderLabel} />
		<button type="button" className={b('row-main')} aria-pressed={selected} onClick={onSelect}>
			<span className={b('row-caption')}>{caption}</span>
			<span className={b('row-value')}>{value}</span>
		</button>
	</li>
));

const SortableRows = SortableContainer<{ children: React.ReactNode; label: string }>(
	({ children, label }: { children: React.ReactNode; label: string }) => (
		<ul className={b('rows')} aria-label={label}>
			{children}
		</ul>
	)
);

interface Props {
	filterOptions: FilterSolvesOptions;
}

/**
 * "Customize stats": the blocks of the stats module as a list on one side, the selected
 * block's settings on the other (stacked on a phone). The list shows each block's live value
 * and is reordered by dragging its handle.
 */
export default function CustomizeStats(props: Props) {
	const { filterOptions } = props;

	const { t } = useTranslation();
	const dispatch = useDispatch();
	const mobileMode = useGeneral('mobile_mode');
	const sessionId = useActiveSessionId();
	const solveDb = useSolveDb();
	const [selectedIndex, setSelectedIndex] = useState(0);
	const saveTimer = useRef<ReturnType<typeof setTimeout>>();

	const stats = useSelector((state: RootStateOrAny) => state?.stats);
	const blocks = (stats.blocks as StatsModuleBlock[]) || [];
	const blockCount = blocks.length;
	const canAddBlocks = blockCount < MAX_STATS_BLOCKS;
	const selected = blocks[Math.min(selectedIndex, blockCount - 1)];

	const filterKey = jsonStr(filterOptions);
	const values = useMemo(
		() => blocks.map((statsBlock) => formatStatsBlockValue(getStatsBlockValueFromFilter(statsBlock, filterOptions, sessionId))),
		[blocks, filterKey, sessionId, solveDb]
	);

	useEffect(() => {
		if (selectedIndex > blockCount - 1) {
			setSelectedIndex(Math.max(0, blockCount - 1));
		}
	}, [blockCount]);

	// A pending write still goes out when the modal closes before the pause ends.
	function scheduleSave() {
		if (saveTimer.current) {
			clearTimeout(saveTimer.current);
		}
		saveTimer.current = setTimeout(() => {
			saveTimer.current = undefined;
			saveStatsModuleBlocks().catch(() => {
				toastError(t('timer_modules.error_save_failed'));
			});
		}, SAVE_DELAY_MS);
	}

	function updateSelected(next: StatsModuleBlock) {
		dispatch(updateStatsModuleBlock(selectedIndex, next));
		scheduleSave();
	}

	function addBlock() {
		if (!canAddBlocks) {
			return;
		}
		dispatch(addStatsModuleBlock({ ...defaultStatsModuleBlocks[blockCount % defaultStatsModuleBlocks.length] }));
		setSelectedIndex(blockCount);
		scheduleSave();
	}

	function removeSelected() {
		if (blockCount <= 1) {
			return;
		}
		dispatch(removeStatsModuleBlock(selectedIndex));
		setSelectedIndex(Math.max(0, selectedIndex - 1));
		scheduleSave();
	}

	function resetToDefaults() {
		dispatch(resetStatsModuleBlocks());
		setSelectedIndex(0);
		scheduleSave();
	}

	function onSortEnd({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) {
		if (oldIndex === newIndex) {
			return;
		}
		dispatch(moveStatsModuleBlock(oldIndex, newIndex));
		// The selection stays on the block it was on, wherever that moved.
		if (selectedIndex === oldIndex) {
			setSelectedIndex(newIndex);
		} else if (oldIndex < selectedIndex && newIndex >= selectedIndex) {
			setSelectedIndex(selectedIndex - 1);
		} else if (oldIndex > selectedIndex && newIndex <= selectedIndex) {
			setSelectedIndex(selectedIndex + 1);
		}
		scheduleSave();
	}

	const reorderLabel = t('timer_modules.stat_editor.reorder');

	return (
		<div className={b()}>
			<section className={b('list')}>
				<h3 className={b('heading')}>{t('timer_modules.stat_editor.blocks')}</h3>
				<SortableRows
					label={t('timer_modules.stat_editor.blocks')}
					useDragHandle
					lockAxis="y"
					lockToContainerEdges
					distance={mobileMode ? 0 : 4}
					helperClass={b('row', { dragging: true }).toString()}
					onSortEnd={onSortEnd}
				>
					{blocks.map((statsBlock, index) => {
						const { key, params } = getStatLabel(statsBlock);
						return (
							<SortableRow
								key={`stat-row-${index}`}
								index={index}
								caption={t(key, params)}
								value={values[index]}
								selected={index === selectedIndex}
								reorderLabel={reorderLabel}
								onSelect={() => setSelectedIndex(index)}
							/>
						);
					})}
				</SortableRows>
				<div className={b('list-actions')}>
					<Button
						small
						gray
						disabled={!canAddBlocks}
						icon={<Plus weight="bold" />}
						iconFirst
						onClick={addBlock}
						text={t('timer_modules.add_block')}
					/>
					<Button small transparent onClick={resetToDefaults} text={t('timer_modules.reset_to_defaults')} />
				</div>
			</section>
			{selected && (
				<section className={b('editor')}>
					<CustomizeStatsEditor
						key={selectedIndex}
						stat={selected}
						canRemove={blockCount > 1}
						onChange={updateSelected}
						onRemove={removeSelected}
					/>
				</section>
			)}
		</div>
	);
}
