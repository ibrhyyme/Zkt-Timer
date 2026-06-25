/**
 * OllcpRoot — admin-only OLLCP recognition mode root. Provider + shared TrainerModeHeader +
 * view router (list → detail → train). Mirrors RecognitionRoot/EfficiencyRoot structure.
 * Multi-select (gallery-style): long-press a card on the list → select mode; the "Çalış" CTA lives
 * top-right in the sticky header (not a bottom bar), so it's always visible.
 */
import React, {ReactNode, useEffect, useRef} from 'react';
import {X, Lightning, CheckSquare} from 'phosphor-react';
import block from '../../../styles/bem';
import './ollcp.scss';
import {useMe} from '../../../util/hooks/useMe';
import {useGeneral} from '../../../util/hooks/useGeneral';
import {useTrainerContext} from '../TrainerContext';
import TrainerModeHeader from '../common/TrainerModeHeader';
import {OllcpProvider, useOllcp} from './OllcpContext';
import {loadOllcpStats} from './stats';
import {OLL_NUMBERS} from './data';
import OllListView from './views/OllListView';
import OllDetailView from './views/OllDetailView';
import OllTrainView from './views/OllTrainView';

const b = block('trainer-ollcp');
const h = block('trainer-header');

function OllcpRouter() {
	const {state} = useOllcp();
	switch (state.view) {
		case 'detail':
			return <OllDetailView />;
		case 'train':
			return <OllTrainView />;
		case 'list':
		default:
			return <OllListView />;
	}
}

function OllcpInner() {
	const {state, goList, backToDetail, enterSelect, exitSelect, trainMulti} = useOllcp();
	const {dispatch} = useTrainerContext();
	const mobileMode = useGeneral('mobile_mode');
	const scrollRef = useRef<HTMLDivElement>(null);
	const {selectMode, selected} = state;

	// Reset scroll to top whenever the view changes (e.g. tapping an OLL while the list is scrolled
	// down must not land the detail view at the bottom).
	useEffect(() => {
		if (scrollRef.current) scrollRef.current.scrollTop = 0;
	}, [state.view, state.currentOll]);

	const onBack = () => {
		// In select mode, back first cancels the selection (instead of leaving the mode).
		if (state.view === 'list' && selectMode) {
			exitSelect();
			return;
		}
		// Multi-OLL mixed session has no single detail to return to → back to the list.
		if (state.view === 'train') state.currentOll ? backToDetail() : goList();
		else if (state.view === 'detail') goList();
		else dispatch({type: 'SET_VIEW', payload: 'landing'}); // list → trainer landing
	};

	// Header top-right actions, only on the list. Select mode → İptal + "Çalış (N)"; otherwise on web
	// a "Seç" entry button (mobile enters select mode via long-press, so its header stays clean).
	let actions: ReactNode = null;
	if (state.view === 'list') {
		if (selectMode) {
			actions = (
				<>
					<button type="button" className={h('btn')} onClick={exitSelect} aria-label="İptal">
						<X size={18} weight="bold" />
					</button>
					<button
						type="button"
						className={h('cta')}
						disabled={selected.length === 0}
						onClick={() => trainMulti(OLL_NUMBERS.filter((n) => selected.includes(n)))}
					>
						<Lightning size={16} weight="fill" />
						<span>Çalış</span>
						<span className={h('cta-count')}>{selected.length}</span>
					</button>
				</>
			);
		} else if (!mobileMode) {
			actions = (
				<button type="button" className={h('btn')} onClick={() => enterSelect()} aria-label="Seç">
					<CheckSquare size={18} weight="duotone" />
				</button>
			);
		}
	}

	return (
		<>
			<TrainerModeHeader mode="ollcp" onBack={onBack} backToRoot={state.view === 'list'} actions={actions} />
			<div className={b()} ref={scrollRef}>
				<OllcpRouter />
			</div>
		</>
	);
}

export default function OllcpRoot() {
	const me = useMe();
	const {dispatch} = useTrainerContext();

	// Admin-only: if a non-admin somehow lands here (stale persisted mode), bounce to landing.
	useEffect(() => {
		if (me && !me.admin) dispatch({type: 'SET_VIEW', payload: 'landing'});
	}, [me, dispatch]);

	// Pull server accuracy (and one-time-merge this device's legacy local data) on mode entry, so the
	// user's two phones share one ✓/✗ tally.
	useEffect(() => {
		if (me?.admin) loadOllcpStats();
	}, [me]);

	if (me && !me.admin) return null;

	return (
		<OllcpProvider>
			<OllcpInner />
		</OllcpProvider>
	);
}
