import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretDown, DotsSixVertical, X } from 'phosphor-react';
import block from '../../../styles/bem';
import TileMenu from './TileMenu';
import ModuleHeaderMenu from './ModuleHeaderMenu';
import { TimerModuleType } from '../@types/enums';
import ModuleBody, { MODULE_LABEL_KEYS } from '../module_registry';
import { PLACEABLE_MODULES, TileDock } from './layout';
import { allowsDragFrom, isTileDragTarget } from './drag_target';
import { domDragEnv } from './dom_env';

const b = block('timer-tile');

interface Props {
	moduleType: TimerModuleType;
	dock: TileDock;
	draggable: boolean;
	/** Float geometry. Docked tiles are sized by their zone and pass nothing. */
	style?: React.CSSProperties;
	onDragStart: (event: React.PointerEvent, id: TimerModuleType) => void;
	onResizeStart?: (event: React.PointerEvent, id: TimerModuleType) => void;
	onRemove: (id: TimerModuleType) => void;
	onReplace: (from: TimerModuleType, to: TimerModuleType) => void;
}

/**
 * One module, as a card.
 *
 * The whole card is the drag handle, minus whatever inside it owns the pointer (see
 * drag_target.ts). It used to be the header only, and a module dropped onto the site's
 * top bar then had its header, and with it every way of moving it, under the bar.
 * Touch is the exception for docked cards, which still move by the header so that the
 * column they sit in can be scrolled by swiping over them.
 *
 * Memoised on its props. A drag re-renders the tile layer twice (lift and drop) and the
 * modules inside must not re-render with it, because one of them is a chart.
 */
function TimerTile(props: Props) {
	const { moduleType, dock, draggable, style, onDragStart, onResizeStart, onRemove, onReplace } = props;
	const { t } = useTranslation();

	const label = t(MODULE_LABEL_KEYS[moduleType] || 'timer_modules.none');
	const floating = dock === 'float';

	function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
		const tile = event.currentTarget;
		const target = event.target as Node;

		// The title opens a menu and the X removes the tile; the module body holds
		// buttons, scrolling lists and the 3D cube. None of those is a drag.
		const press = { pointerType: event.pointerType, x: event.clientX, y: event.clientY };
		if (!isTileDragTarget(target, tile, domDragEnv, press)) {
			return;
		}

		const head = tile.querySelector(`.${b('head')}`);
		if (!allowsDragFrom({ floating, pointerType: event.pointerType, inHeader: !!head && head.contains(target) })) {
			return;
		}

		onDragStart(event, moduleType);
	}

	const options = PLACEABLE_MODULES.map((option) => ({
		key: option,
		label: t(MODULE_LABEL_KEYS[option] || option),
		selected: option === moduleType,
		onSelect: () => onReplace(moduleType, option),
	}));

	return (
		<div
			className={b({ dock, float: floating, draggable })}
			style={style}
			data-tile-id={moduleType}
			onPointerDown={draggable ? handlePointerDown : undefined}
		>
			<div className={b('head')}>
				{/* The title IS the module picker. It used to read as a plain caption, so
				    nobody found it and swapping a module meant removing it and adding
				    another from the "+" menu. */}
				<TileMenu options={options} title={t('timer_tiles.change_module')} className={b('title')}>
					{label}
					<CaretDown weight="bold" className={b('title-caret')} />
				</TileMenu>

				{/* The module's own settings (stats blocks, solves columns), next to its
				    name. Nothing for a module without any. */}
				<ModuleHeaderMenu moduleType={moduleType} />

				{draggable && (
					<>
						<span className={b('grip')} aria-hidden="true">
							<DotsSixVertical weight="bold" />
						</span>
						<button
							type="button"
							className={b('remove')}
							title={t('timer_tiles.remove_module')}
							aria-label={t('timer_tiles.remove_module')}
							onClick={() => onRemove(moduleType)}
						>
							<X weight="bold" />
						</button>
					</>
				)}
			</div>

			<div className={b('body')}>
				<ModuleBody moduleType={moduleType} />
			</div>

			{floating && onResizeStart && (
				<span
					className={b('resize')}
					onPointerDown={(event) => onResizeStart(event, moduleType)}
					// The press bubbles to the card, which would start a move as well.
					data-tile-nodrag=""
					aria-hidden="true"
				/>
			)}
		</div>
	);
}

export default memo(TimerTile);
