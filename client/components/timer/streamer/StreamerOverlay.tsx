import React, { useContext } from 'react';
import { Broadcast } from 'phosphor-react';
import { useTranslation } from 'react-i18next';
import './StreamerOverlay.scss';
import block from '../../../styles/bem';
import { TimerContext } from '../Timer';
import { useMe } from '../../../util/hooks/useMe';
import { useSolveDb } from '../../../util/hooks/useSolveDb';
import { toggleSetting } from '../../../db/settings/update';
import { fetchSolves } from '../../../db/solves/query';
import { canUseStreamerMode } from '../../../lib/streamer-mode';
import HistorySolveRow from '../../modules/history/solve_row/HistorySolveRow';

const b = block('streamer-overlay');

// Number of recent solves shown in the corner mini-history.
const STREAMER_HISTORY_LIMIT = 5;

// Overlay shown ONLY while Streamer Mode is active. The rest of the page chrome
// (header, in-page controls, footer, drawers) is hidden purely via CSS in
// Timer.scss / a body class; this component supplies the two pieces that must
// STAY on the clean stream layout:
//   1. a floating toggle (the only way left to switch the mode back off, since
//      the header toggle is hidden with the rest of the chrome), and
//   2. a small bottom-left mini-history so the streamer can delete a bad/last
//      solve without bringing the whole UI back.
// Neither piece is mirrored (only the time display is), so both read normally on
// the streamer's own monitor.
export default function StreamerOverlay() {
	const { t } = useTranslation();
	const me = useMe();
	const context = useContext(TimerContext);

	// Re-render whenever the local solve DB changes so the mini-history stays live.
	useSolveDb();

	// Defensive: the parent already gates on this, but keep the overlay inert for
	// anyone who isn't allowed to use Streamer Mode.
	if (!canUseStreamerMode(me)) {
		return null;
	}

	const label = t('quick_controls.streamer_mode');

	// Scope to the current session / cube-type bucket exactly like the footer
	// modules do (TimerContext.solvesFilter), newest first.
	const solves = fetchSolves(context?.solvesFilter, { limit: STREAMER_HISTORY_LIMIT });

	return (
		<>
			<button
				type="button"
				className={b('toggle')}
				aria-label={label}
				aria-pressed
				title={label}
				onClick={() => toggleSetting('streamer_mode')}
			>
				<Broadcast weight="fill" size={20} />
			</button>

			{solves.length > 0 && (
				<div className={b('history')}>
					{solves.map((solve, i) => (
						<HistorySolveRow key={solve.id} index={i} solve={solve} />
					))}
				</div>
			)}
		</>
	);
}
