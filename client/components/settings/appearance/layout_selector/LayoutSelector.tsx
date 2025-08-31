import React from 'react';
import './LayoutSelector.scss';
import {AlignRightSimple, AlignBottomSimple, AlignLeftSimple} from 'phosphor-react';
import {setSetting} from '../../../../db/settings/update';
import {useSettings} from '../../../../util/hooks/useSettings';
import block from '../../../../styles/bem';
import Button from '../../../common/button/Button';
import {TimerLayoutPosition} from '../../../../db/settings/query';

const b = block('settings-layout-selector');

export default function LayoutSelector() {
	const timerLayout = useSettings('timer_layout');

	function selectLayout(timerLayout: TimerLayoutPosition) {
		setSetting('timer_layout', timerLayout);
	}

	return (
		<div className={b()}>
			<Button
				onClick={() => {
					selectLayout('left');
				}}
				large
				glow={timerLayout === 'left'}
				primary={timerLayout === 'left'}
				gray
				text="Sola Hizala"
				icon={<AlignLeftSimple weight="bold" />}
			/>
			<Button
				onClick={() => {
					selectLayout('bottom');
				}}
				large
				glow={timerLayout === 'bottom'}
				primary={timerLayout === 'bottom'}
				gray
				text="Ortaya Hizala"
				icon={<AlignBottomSimple weight="bold" />}
			/>
			<Button
				onClick={() => {
					selectLayout('right');
				}}
				large
				primary={timerLayout === 'right'}
				glow={timerLayout === 'right'}
				gray
				text="Sağa Hizala"
				icon={<AlignRightSimple weight="bold" />}
			/>
		</div>
	);
}
