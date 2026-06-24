/**
 * OllcpRoot — admin-only OLLCP recognition mode root. Provider + shared TrainerModeHeader +
 * view router (list → detail → train). Mirrors RecognitionRoot/EfficiencyRoot structure.
 */
import React, {useEffect, useRef} from 'react';
import block from '../../../styles/bem';
import './ollcp.scss';
import {useMe} from '../../../util/hooks/useMe';
import {useTrainerContext} from '../TrainerContext';
import TrainerModeHeader from '../common/TrainerModeHeader';
import {OllcpProvider, useOllcp} from './OllcpContext';
import {loadOllcpStats} from './stats';
import OllListView from './views/OllListView';
import OllDetailView from './views/OllDetailView';
import OllTrainView from './views/OllTrainView';

const b = block('trainer-ollcp');

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
	const {state, goList, backToDetail} = useOllcp();
	const {dispatch} = useTrainerContext();
	const scrollRef = useRef<HTMLDivElement>(null);

	// Reset scroll to top whenever the view changes (e.g. tapping an OLL while the list is scrolled
	// down must not land the detail view at the bottom).
	useEffect(() => {
		if (scrollRef.current) scrollRef.current.scrollTop = 0;
	}, [state.view, state.currentOll]);

	const onBack = () => {
		// Multi-OLL mixed session has no single detail to return to → back to the list.
		if (state.view === 'train') state.currentOll ? backToDetail() : goList();
		else if (state.view === 'detail') goList();
		else dispatch({type: 'SET_VIEW', payload: 'landing'}); // list → trainer landing
	};

	return (
		<>
			<TrainerModeHeader mode="ollcp" onBack={onBack} backToRoot={state.view === 'list'} />
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
