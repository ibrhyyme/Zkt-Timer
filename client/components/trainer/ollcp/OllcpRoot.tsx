/**
 * OllcpRoot — admin-only OLLCP recognition mode root. Provider + shared TrainerModeHeader +
 * view router (list → detail → train). Mirrors RecognitionRoot/EfficiencyRoot structure.
 */
import React, {useEffect} from 'react';
import block from '../../../styles/bem';
import './ollcp.scss';
import {useMe} from '../../../util/hooks/useMe';
import {useTrainerContext} from '../TrainerContext';
import TrainerModeHeader from '../common/TrainerModeHeader';
import {OllcpProvider, useOllcp} from './OllcpContext';
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

	const onBack = () => {
		if (state.view === 'train') backToDetail();
		else if (state.view === 'detail') goList();
		else dispatch({type: 'SET_VIEW', payload: 'landing'}); // list → trainer landing
	};

	return (
		<>
			<TrainerModeHeader mode="ollcp" onBack={onBack} backToRoot={state.view === 'list'} />
			<div className={b()}>
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

	if (me && !me.admin) return null;

	return (
		<OllcpProvider>
			<OllcpInner />
		</OllcpProvider>
	);
}
