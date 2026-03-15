// Import React and dynamic
import React, { useState, Suspense, useRef } from 'react';
import ReactDOM from 'react-dom';
import './ScrambleVisual.scss';
import block from '../../../styles/bem';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { useSettings } from '../../../util/hooks/useSettings';

// Dynamically import TwistyPlayerWrapper
const TwistyPlayerWrapper = React.lazy(() => import('./TwistyPlayerWrapper'));

const b = block('scramble-visual');

// Map for TwistyPlayer identifiers
const PUZZLE_MAPPING: Record<string, string> = {
	'333': '3x3x3',
	'222': '2x2x2',
	'444': '4x4x4',
	'555': '5x5x5',
	'666': '6x6x6',
	'777': '7x7x7',
	'clock': 'clock',
	'minx': 'megaminx',
	'pyram': 'pyraminx',
	'sq1': 'square1',
	'skewb': 'skewb',
	'333oh': '3x3x3',
	'333bl': '3x3x3',
	'333mirror': '3x3x3',
	'222oh': '2x2x2',
};

const NXN_PUZZLE_IDS = new Set(['2x2x2', '3x3x3', '4x4x4', '5x5x5', '6x6x6', '7x7x7']);

interface Props {
	cubeType: string;
	scramble: string;
	width?: string;
	frontFace?: boolean;
}

function ScrambleVisual(props: Props) {
	const { cubeType, scramble, frontFace } = props;
	const [isExpanded, setIsExpanded] = useState(false);
	const mobileMode = useGeneral('mobile_mode');
	const use2dScramble = useSettings('use_2d_scramble_visual');
	const width = props.width || '100%';

	// Determine puzzle details for TwistyPlayer
	const puzzleId = PUZZLE_MAPPING[cubeType] || cubeType;
	const isClock = puzzleId === 'clock';
	const isPyram = puzzleId === 'pyraminx';
	const isSq1 = puzzleId === 'square1';
	const isNxN = NXN_PUZZLE_IDS.has(puzzleId);
	const visualizationVal = (isClock || isPyram) ? '2D' : (use2dScramble && isNxN) ? '2D' : '3D';

	const closeModal = (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsExpanded(false);
	};

	// --- HANDLERS (Long Press) ---
	const touchStartX = useRef<number | null>(null);
	const longPressTimer = useRef<NodeJS.Timeout | null>(null);

	const handleTouchStart = (e: React.TouchEvent) => {
		touchStartX.current = e.touches[0].clientX;
		// Start long press timer
		longPressTimer.current = setTimeout(() => {
			if (mobileMode) setIsExpanded(true);
		}, 500);
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		if (touchStartX.current !== null) {
			const diff = Math.abs(e.touches[0].clientX - touchStartX.current);
			// If moved more than 10px, cancel long press (it's a swipe/scroll)
			if (diff > 10 && longPressTimer.current) {
				clearTimeout(longPressTimer.current);
				longPressTimer.current = null;
			}
		}
	};

	const handleTouchEnd = () => {
		if (longPressTimer.current) {
			clearTimeout(longPressTimer.current);
			longPressTimer.current = null;
		}
		touchStartX.current = null;
	};

	// --- MODAL CONTENT ---
	const expandedModalContent = isExpanded && mobileMode ? (
		<div className={b('expanded-overlay')} onClick={closeModal}>
			<div className={b('expanded-content')} onClick={(e) => e.stopPropagation()}>
				<div className={b('expanded-close')} onClick={closeModal}>✕</div>
				<div className={b('expanded-twisty-container')} style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
					<Suspense fallback={<div>Yükleniyor...</div>}>
						<TwistyPlayerWrapper
							puzzle={puzzleId}
							alg={scramble}
							visualization={visualizationVal}
							className={b('twisty-player-expanded')}
						/>
					</Suspense>
				</div>
			</div>
		</div>
	) : null;

	const expandedModal = expandedModalContent && typeof document !== 'undefined'
		? ReactDOM.createPortal(expandedModalContent, document.body)
		: null;

	const containerStyle: React.CSSProperties = (isClock && frontFace)
		? {
			width: '100%',
			overflow: 'hidden',
			display: 'flex',
			justifyContent: 'flex-start',
			alignItems: 'center'
		}
		: isClock
			? { width: '100%', overflow: 'hidden', display: 'flex', justifyContent: 'center' }
			: { width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' };

	const innerStyle: React.CSSProperties = (isClock && frontFace)
		? {
			width: '200%',
			transform: 'translateX(0)',
			display: 'flex',
		}
		: isClock
			? { width: '100%', display: 'flex', justifyContent: 'center' }
			: { width: '100%' };

	if (puzzleId === 'other') {
		return <div className={b('invalid')}>No visual</div>;
	}

	return (
		<div className={`${b('wrapper', { clickable: false })} ${b()}`} style={{ width: width }}>
			<div
				style={containerStyle}
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
			>
				<div style={innerStyle}>
					<Suspense fallback={<div className={b('loading')}>Yükleniyor...</div>}>
						<TwistyPlayerWrapper
							puzzle={puzzleId}
							alg={scramble}
							visualization={visualizationVal}
							className={b('twisty-player')}
						/>
					</Suspense>
				</div>
			</div>
			{expandedModal}
		</div>
	);
}

// Memoized to prevent re-renders when scramble hasn't changed
export default React.memo(ScrambleVisual, (prevProps, nextProps) => {
	return (
		prevProps.cubeType === nextProps.cubeType &&
		prevProps.scramble === nextProps.scramble &&
		prevProps.width === nextProps.width &&
		prevProps.frontFace === nextProps.frontFace
	);
});
