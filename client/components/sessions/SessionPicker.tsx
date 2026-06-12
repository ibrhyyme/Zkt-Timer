import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'phosphor-react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { setCubeType, setCurrentSession, setScrambleSubset } from '../../db/settings/update';
import { fetchSessionById, fetchSessions } from '../../db/sessions/query';
import { fetchLastBucketForSession } from '../../db/solves/query';
import { useSettings } from '../../util/hooks/useSettings';
import { getSetting } from '../../db/settings/query';
import { getCubeTypeInfoById } from '../../util/cubes/util';
import { getNewScrambleAsync } from '../timer/helpers/scramble';
import { setTimerParam, setTimerParams } from '../timer/helpers/params';
import FancyDropdown, { FancyDropdownGroup } from '../timer/header_control/FancyDropdown';
import { Session } from '../../../server/schemas/Session.schema';
import { openModal } from '../../actions/general';
import CreateNewSession from './new_session/CreateNewSession';
import { useMe } from '../../util/hooks/useMe';
import { useSessionDb } from '../../util/hooks/useSessionDb';

interface Props {
	stateless?: boolean;
	hideSessionName?: boolean;
	onChange?: (session: Session) => void;
}

const ACTION_NEW_SESSION = '__action__new_session';

export default function SessionPicker(props: Props) {
	const dispatch = useDispatch();
	const { t } = useTranslation();
	const me = useMe();
	const sessionId = useSettings('session_id');
	const sessionDbChangeCounter = useSessionDb();

	const [selectedSession, setSelectedSession] = useState<Session>();
	const { onChange, hideSessionName, stateless } = props;

	useEffect(() => {
		if (stateless) return;
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

	const groups: FancyDropdownGroup[] = useMemo(() => {
		const sessions = fetchSessions();
		const showNewSessionButton = me && !stateless;

		const sessionGroup: FancyDropdownGroup = {
			options: sessions.map((ses) => ({
				value: ses.id,
				label: ses.name,
			})),
		};

		if (showNewSessionButton) {
			return [
				sessionGroup,
				{
					options: [
						{
							value: ACTION_NEW_SESSION,
							label: `${t('sessions.new_session')}`,
							icon: <Plus weight="bold" size={16} />,
						},
					],
				},
			];
		}
		return [sessionGroup];
	}, [selectedSession, me, stateless, t, sessionDbChangeCounter]);

	function switchSession(session: Session) {
		setSelectedSession(session);
		if (onChange) onChange(session);

		if (stateless) return;

		setCurrentSession(session.id);

		// Empty session -> fall back to the canonical wca::333 bucket, NOT standalone
		// 333::null (which is the duplicate "3x3" box and pollutes the global setting,
		// making every subsequent solve land in the wrong bucket). See cube-subset-bucket.
		const lastBucket = fetchLastBucketForSession(session.id);
		const lastCubeType = lastBucket?.cube_type || 'wca';
		const currentCubeType = getSetting('cube_type');
		const currentSubset = getSetting('scramble_subset');
		const newSubset = lastBucket?.scramble_subset ?? (lastCubeType === 'wca' ? '333' : null);
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
				setTimerParams({ scramble: '', originalScramble: '', smartTurnOffset: 0 });
				getNewScrambleAsync(ct.scramble, newSubset ?? undefined).then((newScramble) => {
					setTimerParams({ scramble: newScramble, originalScramble: newScramble, smartTurnOffset: 0 });
				}).catch((e) => {
					console.error('[scramble] switchSession failed:', e);
				});
			}
		}
	}

	function handleValueChange(value: string) {
		if (value === ACTION_NEW_SESSION) {
			toggleCreateNewSession();
			return;
		}
		const session = fetchSessions().find(s => s.id === value);
		if (session) {
			switchSession(session);
		}
	}

	let sessionName = 'Select Session';
	if (selectedSession && !hideSessionName) {
		sessionName = selectedSession.name;
	}

	// Radix Select doesn't like empty string — use virtual placeholder when no selectedSession
	const NO_SESSION = '__no_session__';

	return (
		<div className="cd-session-picker">
			<FancyDropdown
				value={selectedSession?.id || NO_SESSION}
				onValueChange={handleValueChange}
				groups={groups}
				triggerLabel={sessionName}
				ariaLabel="Session"
				maxHeight={400}
				triggerMaxWidth={180}
			/>
		</div>
	);
}
