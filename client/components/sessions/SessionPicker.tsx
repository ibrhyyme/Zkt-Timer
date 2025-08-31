import React, {useEffect, useMemo, useState} from 'react';
import {CaretDown} from 'phosphor-react';
import {useDispatch} from 'react-redux';
import {setCubeType, setCurrentSession} from '../../db/settings/update';
import {fetchSessionById, fetchSessions} from '../../db/sessions/query';
import {fetchLastCubeTypeForSession} from '../../db/solves/query';
import {useSettings} from '../../util/hooks/useSettings';
import Dropdown from '../common/inputs/dropdown/Dropdown';
import {Session} from '../../../server/schemas/Session.schema';
import {openModal} from '../../actions/general';
import CreateNewSession from './new_session/CreateNewSession';
import {useMe} from '../../util/hooks/useMe';

interface Props {
	stateless?: boolean;
	hideSessionName?: boolean; // Will just show "Session"
	onChange?: (session: Session) => void;
}

export default function SessionPicker(props: Props) {
	const dispatch = useDispatch();
	const me = useMe();
	const sessionId = useSettings('session_id');

	const [selectedSession, setSelectedSession] = useState<Session>();
	const {onChange, hideSessionName, stateless} = props;

	useEffect(() => {
		if (stateless) {
			return;
		}

		const currentSession = fetchSessionById(sessionId);
		setSelectedSession(currentSession);
	}, [sessionId]);

	function toggleCreateNewSession() {
		dispatch(openModal(<CreateNewSession />));
	}

	const options = useMemo(() => {
		const sessionOptions = fetchSessions().map((ses) => ({
			text: ses.name,
			disabled: selectedSession?.id === ses.id,
			onClick: () => switchSession(ses),
		}));

		// Add "Yeni sezon +" as the first option if user is logged in
		if (me && !stateless) {
			return [
				{
					text: 'Yeni sezon +',
					onClick: toggleCreateNewSession,
					separator: true, // Add separator after this item
				},
				...sessionOptions,
			];
		}

		return sessionOptions;
	}, [selectedSession, me, stateless]);

	function switchSession(session: Session) {
		setSelectedSession(session);
		if (onChange) {
			onChange(session);
		}

		if (stateless) {
			return;
		}

		setCurrentSession(session.id);

		const lastCubeType = fetchLastCubeTypeForSession(session.id);
		setCubeType(lastCubeType || '333');
	}

	let sessionName = 'Select Session';
	if (selectedSession && !hideSessionName) {
		sessionName = selectedSession.name;
	}

	return (
		<div>
			<Dropdown noMargin openLeft text={sessionName} icon={<CaretDown />} options={options} />
		</div>
	);
}
