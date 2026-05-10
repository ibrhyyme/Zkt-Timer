import React, {useEffect, useMemo, useState} from 'react';
import {CaretDown} from 'phosphor-react';
import {useDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {setCubeType, setCurrentSession, setScrambleSubset} from '../../db/settings/update';
import {fetchSessionById, fetchSessions} from '../../db/sessions/query';
import {fetchLastBucketForSession} from '../../db/solves/query';
import {useSettings} from '../../util/hooks/useSettings';
import {getSetting} from '../../db/settings/query';
import {getCubeTypeInfoById} from '../../util/cubes/util';
import {getNewScrambleAsync} from '../timer/helpers/scramble';
import {setTimerParam, setTimerParams} from '../timer/helpers/params';
import Dropdown from '../common/inputs/dropdown/Dropdown';
import {Session} from '../../../server/schemas/Session.schema';
import {openModal} from '../../actions/general';
import CreateNewSession from './new_session/CreateNewSession';
import {useMe} from '../../util/hooks/useMe';
import {useSessionDb} from '../../util/hooks/useSessionDb';

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
	const sessionDbChangeCounter = useSessionDb();

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
	}, [selectedSession, me, stateless, t, sessionDbChangeCounter]);

	function switchSession(session: Session) {
		setSelectedSession(session);
		if (onChange) {
			onChange(session);
		}

		if (stateless) {
			return;
		}

		setCurrentSession(session.id);

		const lastBucket = fetchLastBucketForSession(session.id);
		const lastCubeType = lastBucket?.cube_type || '333';
		const currentCubeType = getSetting('cube_type');
		const currentSubset = getSetting('scramble_subset');
		const newSubset = lastBucket?.scramble_subset ?? null;
		const cubeTypeChanged = lastCubeType !== currentCubeType;
		const subsetChanged = newSubset !== (currentSubset ?? null);

		if (cubeTypeChanged) {
			setCubeType(lastCubeType);
		}
		if (subsetChanged) {
			setScrambleSubset(newSubset);
		}

		if (cubeTypeChanged || subsetChanged) {
			const ct = getCubeTypeInfoById(lastCubeType);
			if (ct) {
				setTimerParam('scrambleSubset', newSubset);
				setTimerParams({scramble: '', originalScramble: '', smartTurnOffset: 0});
				getNewScrambleAsync(ct.scramble, newSubset ?? undefined).then((newScramble) => {
					setTimerParams({scramble: newScramble, originalScramble: newScramble, smartTurnOffset: 0});
				}).catch((e) => {
					console.error('[scramble] switchSession failed:', e);
				});
			}
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
