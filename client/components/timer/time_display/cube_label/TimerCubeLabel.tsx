import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { Cube } from 'phosphor-react';
import { openModal } from '../../../../actions/general';
import block from '../../../../styles/bem';
import { CubeSelectList, useCubeSelectView } from '../../../quick-controls/cube_select/CubeSelectRow';
import { CubeSelectView, timerCubeLabel } from '../../../quick-controls/cube_select/cube_select_state';
import '../magnet/MagnetGuide.scss';

const b = block('timer-cube-label');

interface PickerProps {
	view: Extract<CubeSelectView, { kind: 'select' }>;
	/** Injected by Modal: closes it. */
	onComplete?: () => void;
}

function CubeLabelPicker({ view, onComplete }: PickerProps) {
	return <CubeSelectList view={view} onDone={() => onComplete && onComplete()} />;
}

interface Props {
	magnetOwnsInput: boolean;
	/**
	 * False while inspecting or solving: the label keeps its height (visibility hidden) so the
	 * digits never move at the start and the stop.
	 */
	visible: boolean;
}

/**
 * The cube the next solve is stamped with, a small label under the digits (design magnet-cubes
 * 5.5). Shown only when the puzzle has a main cube. A tap opens the same picker as the quick
 * settings row ("Çözüm yapılan küp"), so changing cubes needs no trip through the menus.
 */
export default function TimerCubeLabel({ magnetOwnsInput, visible }: Props) {
	const { t } = useTranslation();
	const dispatch = useDispatch();
	const view = useCubeSelectView(magnetOwnsInput);
	const cube = timerCubeLabel(view);

	if (!cube || view.kind !== 'select') return null;

	function openPicker() {
		if (view.kind !== 'select') return;
		dispatch(
			openModal(<CubeLabelPicker view={view} />, {
				compact: true,
				width: 380,
				title: t('cube_select.label'),
			})
		);
	}

	return (
		<div className={b({ hidden: !visible })}>
			<button
				type="button"
				className={b('button')}
				onClick={openPicker}
				disabled={!visible}
				aria-label={t('cube_select.label_aria', { name: cube.name })}
			>
				<Cube weight="bold" className={b('icon')} aria-hidden="true" />
				<span className={b('name')}>{cube.name}</span>
			</button>
		</div>
	);
}
