import React, {useRef} from 'react';
import {useHistory, useLocation} from 'react-router-dom';
import {CaretLeft} from 'phosphor-react';
import './SwipeBackIndicator.scss';
import {useSwipeBack} from '../../../util/hooks/useSwipeBack';
import {useGeneral} from '../../../util/hooks/useGeneral';
import block from '../../../styles/bem';

const b = block('swipe-back-indicator');

export default function SwipeBackIndicator() {
	const history = useHistory();
	const location = useLocation();
	const mobileMode = useGeneral('mobile_mode');
	const modals = useGeneral('modals');
	const settingsModalOpen = useGeneral('settings_modal_open');
	const indicatorRef = useRef<HTMLDivElement>(null);

	const isTimerPage = location.pathname === '/timer';
	const hasOpenModal = modals.length > 0 || settingsModalOpen;
	const isRootPage = location.pathname === '/' || location.pathname === '/timer';

	const disabled = !mobileMode || isTimerPage || hasOpenModal || isRootPage;

	const {progress, phase} = useSwipeBack({
		containerRef: indicatorRef,
		onSwipeBack: () => history.goBack(),
		disabled,
		edgeWidth: 36,
		threshold: 120,
		useWindow: true,
	});

	if (disabled || phase === 'idle') return null;

	return (
		<div ref={indicatorRef} className={b()}>
			<div
				className={b('arrow')}
				style={{
					opacity: Math.min(progress * 1.5, 1),
					transform: `translateY(-50%) translateX(${progress * 16}px) scale(${0.6 + progress * 0.4})`,
				}}
			>
				<CaretLeft size={20} weight="bold" />
			</div>
		</div>
	);
}
