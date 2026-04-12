import React, {useEffect, useMemo, useState} from 'react';
import {CaretDown} from 'phosphor-react';
import {useDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {setCubeType, setCurrentSession} from '../../db/settings/update';
import {fetchSessionById, fetchSessions} from '../../db/sessions/query';
import {fetchLastCubeTypeForSession} from '../../db/solves/query';
import {useSettings} from '../../util/hooks/useSettings';
import {getSetting} from '../../db/settings/query';
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
	const {t} = useTranslation();
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
		dispatch(openModal(<CreateNewSession />, {
			compact: true,
			width: 420,
			title: t('sessions.create_new_session_title'),
			description: t('sessions.create_new_session_desc'),
			closeButtonText: t('solve_info.done'),
		}));
	}

	const options = useMemo(() => {
		const sessions = fetchSessions();
		const showNewSessionButton = me && !stateless;

		const sessionOptions = sessions.map((ses, i) => ({
			text: ses.name,
			disabled: selectedSession?.id === ses.id,
			onClick: () => switchSession(ses),
			separator: showNewSessionButton && i === sessions.length - 1,
		}));

		if (showNewSessionButton) {
			return [
				...sessionOptions,
				{
					text: `${t('sessions.new_session')} +`,
					onClick: toggleCreateNewSession,
				},
			];
		}

		return sessionOptions;
	}, [selectedSession, me, stateless, t]);

	function switchSession(session: Session) {
		setSelectedSession(session);
		if (onChange) {
			onChange(session);
		}

		if (stateless) {
			return;
		}

		setCurrentSession(session.id);

		const lastCubeType = fetchLastCubeTypeForSession(session.id) || '333';
		const currentCubeType = getSetting('cube_type');
		if (lastCubeType !== currentCubeType) {
			setCubeType(lastCubeType);
		}
	}

	let sessionName = 'Select Session';
	if (selectedSession && !hideSessionName) {
		sessionName = selectedSession.name;
	}

	return (
		<div className="cd-session-picker">
			<Dropdown noMargin openLeft text={sessionName} icon={<CaretDown />} options={options} />
		</div>
	);
}
