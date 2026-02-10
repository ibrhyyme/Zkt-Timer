// Import React and dynamic
import React, { useState, Suspense, useRef } from 'react';
import ReactDOM from 'react-dom';
import './ScrambleVisual.scss';
import block from '../../../styles/bem';
import { useGeneral } from '../../../util/hooks/useGeneral';

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
	const width = props.width || '100%';

	// Determine puzzle details for TwistyPlayer
	const puzzleId = PUZZLE_MAPPING[cubeType] || cubeType;
	const isClock = puzzleId === 'clock';
	const isSq1 = puzzleId === 'square1';
	const visualizationVal = isClock ? '2D' : '3D';

	const closeModal = (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsExpanded(false);
	};

	// --- HANDLERS (Long Press & Swipe) ---
	const [clockFace, setClockFace] = useState<'front' | 'back'>('front');
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

	const handleTouchEnd = (e: React.TouchEvent) => {
		// Clear timer on release (if it hasn't fired yet)
		if (longPressTimer.current) {
			clearTimeout(longPressTimer.current);
			longPressTimer.current = null;
		}

		if (touchStartX.current === null) return;
		const diff = touchStartX.current - e.changedTouches[0].clientX;
		if (Math.abs(diff) > 30) { // Swipe threshold
			if (diff > 0) setClockFace('back'); // Swipe left -> show back
			else setClockFace('front'); // Swipe right -> show front
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

	// Clock Dimensions
	const CLOCK_FULL_WIDTH = 340;
	const CLOCK_HALF_WIDTH = CLOCK_FULL_WIDTH / 2;

	// Clock Mobile Logic (Swipe View)
	const isClockMobile = isClock && mobileMode && !frontFace;

	const containerStyle: React.CSSProperties = isClockMobile
		? {
			width: `${CLOCK_HALF_WIDTH}px`, // Show only one face
			overflow: 'hidden',
			display: 'flex',
			justifyContent: 'flex-start', // Start from left to allow sliding
			margin: '0 auto',
			position: 'relative',
			touchAction: 'pan-y' // Allow vertical scroll, capture horizontal
		}
		: (isClock && frontFace)
			? {
				width: '100%',
				overflow: 'hidden',
				display: 'flex',
				justifyContent: 'flex-start',
				alignItems: 'center'
			}
			: isClock
				? { width: '100%', overflowX: 'auto', display: 'flex', justifyContent: 'center' }
				: { width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' };

	const innerStyle: React.CSSProperties = isClockMobile
		? {
			minWidth: `${CLOCK_FULL_WIDTH}px`,
			transform: clockFace === 'back' ? `translateX(-${CLOCK_HALF_WIDTH}px)` : 'translateX(0)',
			transition: 'transform 0.3s ease-in-out',
			display: 'flex',
			justifyContent: 'center'
		}
		: (isClock && frontFace)
			? {
				width: '200%', // Force 200% width to show one face in 100% container
				transform: 'translateX(0)', // Always show from left (front face)
				display: 'flex',
			}
			: isClock
				? { width: '100%', display: 'flex', justifyContent: 'center' } // Normal Clock - center both faces
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
			{/* Dots indicator for Clock Mobile */}
			{isClockMobile && (
				<div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
					<div style={{ width: '8px', height: '8px', borderRadius: '50%', background: clockFace === 'front' ? '#fff' : '#ffffff40' }} />
					<div style={{ width: '8px', height: '8px', borderRadius: '50%', background: clockFace === 'back' ? '#fff' : '#ffffff40' }} />
				</div>
			)}
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
