import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretDown, DotsSixVertical, X } from 'phosphor-react';
import block from '../../../styles/bem';
import TileMenu from './TileMenu';
import { TimerModuleType } from '../@types/enums';
import ModuleBody, { MODULE_LABEL_KEYS } from '../module_registry';
import { PLACEABLE_MODULES, TileDock } from './layout';

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
 * The whole header is the drag handle, minus its buttons: a dedicated 56px grip is easy
 * to miss (tagda shipped one at 40x15px and users never found it), and a header that
 * also carries the module's name gives the card a title it never had.
 *
 * Memoised on its props. A drag re-renders the tile layer twice (lift and drop) and the
 * modules inside must not re-render with it, because one of them is a chart.
 */
function TimerTile(props: Props) {
	const { moduleType, dock, draggable, style, onDragStart, onResizeStart, onRemove, onReplace } = props;
	const { t } = useTranslation();

	const label = t(MODULE_LABEL_KEYS[moduleType] || 'timer_modules.none');
	const floating = dock === 'float';

	function handlePointerDown(event: React.PointerEvent) {
		// The title opens a menu and the X removes the tile. Neither is a drag, and a
		// header without this check means neither is clickable.
		if ((event.target as HTMLElement).closest('button')) {
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
		<div className={b({ dock, float: floating, draggable })} style={style} data-tile-id={moduleType}>
			<div className={b('head')} onPointerDown={draggable ? handlePointerDown : undefined}>
				{/* The title IS the module picker. It used to read as a plain caption, so
				    nobody found it and swapping a module meant removing it and adding
				    another from the "+" menu. */}
				<TileMenu options={options} title={t('timer_tiles.change_module')} className={b('title')}>
					{label}
					<CaretDown weight="bold" className={b('title-caret')} />
				</TileMenu>

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
					aria-hidden="true"
				/>
			)}
		</div>
	);
}

export default memo(TimerTile);
