// Import React and dynamic
import React, { useState, Suspense, useRef } from 'react';
import ReactDOM from 'react-dom';
import './ScrambleVisual.scss';
import block from '../../../styles/bem';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { useSettings } from '../../../util/hooks/useSettings';
import { useTranslation } from 'react-i18next';

// Dynamically import TwistyPlayerWrapper
const TwistyPlayerWrapper = React.lazy(() => import('./TwistyPlayerWrapper'));
// Sq1 icin custom 2D canvas renderer (cstimer style)
const Sq1Renderer = React.lazy(() => import('./Sq1Renderer'));
// Clock icin custom 2D canvas renderer (cstimer style)
const ClockRenderer = React.lazy(() => import('./ClockRenderer'));

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
	// Method-based 3x3 variants
	'333cfop': '3x3x3',
	'333roux': '3x3x3',
	'333mehta': '3x3x3',
	'333zz': '3x3x3',
	'333fm': '3x3x3',
	'333mbld': '3x3x3',
	'333sub': '3x3x3',
	// 4x4 variants
	'444yau': '4x4x4',
	'444bl': '4x4x4',
	// 5x5 variant
	'555bl': '5x5x5',
	// WCA default
	'wca': '3x3x3',
};

const NXN_PUZZLE_IDS = new Set(['2x2x2', '3x3x3', '4x4x4', '5x5x5', '6x6x6', '7x7x7']);
const ALWAYS_2D_PUZZLES = new Set(['clock']);
const TOGGLE_PUZZLES = new Set([...NXN_PUZZLE_IDS, 'pyraminx', 'megaminx', 'skewb']);
const VALID_TWISTY_PUZZLES = new Set([...NXN_PUZZLE_IDS, 'clock', 'megaminx', 'pyraminx', 'square1', 'skewb']);

interface Props {
	cubeType: string;
	scramble: string;
	width?: string;
	frontFace?: boolean;
	compact?: boolean;
}

function ScrambleVisual(props: Props) {
	const { cubeType, scramble, frontFace, compact } = props;
	const { t } = useTranslation();
	const [isExpanded, setIsExpanded] = useState(false);
	const mobileMode = useGeneral('mobile_mode');
	const use2dScramble = useSettings('use_2d_scramble_visual');
	const width = props.width || '100%';

	// Determine puzzle details for TwistyPlayer
	const puzzleId = PUZZLE_MAPPING[cubeType] || cubeType;

	// SQ1: backtick karakteri cubing.js parser'ini kiriyor — temizle
	const viewerAlg = puzzleId === 'square1' && scramble
		? scramble.replace(/`/g, '')
		: scramble;

	const isClock = puzzleId === 'clock';
	const visualizationVal = ALWAYS_2D_PUZZLES.has(puzzleId)
		? '2D'
		: TOGGLE_PUZZLES.has(puzzleId)
			? (use2dScramble ? '2D' : '3D')
			: '3D';

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
					<Suspense fallback={<div>{t('common.loading')}</div>}>
						{puzzleId === 'square1' ? (
							<Sq1Renderer scramble={viewerAlg} className={b('sq1-renderer-expanded')} />
						) : puzzleId === 'clock' ? (
							<ClockRenderer scramble={viewerAlg} className={b('clock-renderer-expanded')} />
						) : (
							<TwistyPlayerWrapper
								puzzle={puzzleId}
								alg={viewerAlg}
								visualization={visualizationVal}
								className={b('twisty-player-expanded')}
							/>
						)}
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

	// === Early returns (tum hook'lardan SONRA) ===

	// Desteklenmeyen puzzle tipi
	if (!VALID_TWISTY_PUZZLES.has(puzzleId)) {
		return null;
	}

	// Relay: multi-scramble formati, tek viewer ile gosterilemez
	if (cubeType === 'relay') {
		return null;
	}

	// Clock: kendi custom renderer'imiz var, tum notasyonlar destekleniyor

	// Megaminx: TwistyPlayer sadece Pochmann (R++ D--) ve 2-Gen (R, U) destekliyor
	if (puzzleId === 'megaminx' && scramble && !scramble.includes('++') && !scramble.includes('--')) {
		const moves = scramble.trim().split(/\s+/);
		const is2Gen = moves.every(m => /^[RU](2'?|')?$/.test(m));
		if (!is2Gen) return null;
	}

	// Custom 2D canvas renderer'lar (cstimer style)
	const isSquareOne = puzzleId === 'square1';
	const isClockCustom = puzzleId === 'clock';

	return (
		<div className={`${b('wrapper', { clickable: false })} ${b()}`} style={{ width: width }}>
			<div
				style={containerStyle}
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
			>
				<div style={innerStyle}>
					<Suspense fallback={<div className={b('loading')}>{t('common.loading')}</div>}>
						{isSquareOne ? (
							<Sq1Renderer scramble={viewerAlg} className={b('sq1-renderer')} baseWidth={compact ? 14 : undefined} />
						) : isClockCustom ? (
							<ClockRenderer scramble={viewerAlg} className={b('clock-renderer')} />
						) : (
							<TwistyPlayerWrapper
								puzzle={puzzleId}
								alg={viewerAlg}
								visualization={visualizationVal}
								className={b('twisty-player')}
							/>
						)}
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
		prevProps.frontFace === nextProps.frontFace &&
		prevProps.compact === nextProps.compact
	);
});
