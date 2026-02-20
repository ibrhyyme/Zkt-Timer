import React from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import './Session.scss';
import { setCubeType, setCurrentSession } from '../../../db/settings/update';
import { v4 as uuid } from 'uuid';
import { getDateFromNow } from '../../../util/dates';
import { fetchLastCubeTypeForSession } from '../../../db/solves/query';
import { Session as SessionSchema } from '../../../../server/schemas/Session.schema';
import { createSessionDb, deleteSessionDb, mergeSessionsDb } from '../../../db/sessions/update';
import block from '../../../styles/bem';
import { openModal } from '../../../actions/general';
import ConfirmModal from '../../common/confirm_modal/ConfirmModal';
import { fetchSessionById } from '../../../db/sessions/query';
import { useSettings } from '../../../util/hooks/useSettings';
import { toastSuccess } from '../../../util/toast';
import { reactState } from '../../../@types/react';

const b = block('session-row');

interface Props {
	setSelectedSessionId: reactState<string>;
	selectedSessionId: string;
	session: SessionSchema;
	selectSession: (e, id) => void;
	isMultiSelected?: boolean;
}

export default function Session(props: Props) {
	const currentSessionId = useSettings('session_id');
	const dispatch = useDispatch();
	const { t } = useTranslation();

	const { session, selectedSessionId, selectSession, isMultiSelected } = props;

	const currentSession = fetchSessionById(currentSessionId);
	const sessionIsSelected = selectedSessionId === session.id;
	const isCurrentSession = session.id === currentSessionId;

	const lastCubeType = fetchLastCubeTypeForSession(session.id) || '333';

	function makeCurrent() {
		setCurrentSession(session.id);
		setCubeType(lastCubeType);
	}

	async function mergeSessions() {
		dispatch(
			openModal(
				<ConfirmModal
					title={t('sessions.merge_sessions_title')}
					description={t('sessions.merge_confirm_desc', { source: session.name, target: currentSession.name })}
					triggerAction={async () => {
						await mergeSessionsDb(session.id, currentSessionId);
						props.setSelectedSessionId(currentSessionId);
					}}
					buttonText={t('sessions.merge_sessions')}
					buttonProps={{
						danger: true,
					}}
				/>
			)
		);
	}

	async function deleteSession() {
		async function triggerAction() {
			const id = session.id;
			const name = session.name;
			let updatedSessionId = currentSessionId;
			if (currentSessionId === id) {
				const newId = uuid();

				await createSessionDb({
					name: t('sessions.new_session'),
					id: newId,
				});

				setCurrentSession(newId);
				setCubeType('333');

				updatedSessionId = newId;
			}

			props.setSelectedSessionId(updatedSessionId);
			await deleteSessionDb(session);
			toastSuccess(t('sessions.session_deleted', { name }));
		}

		dispatch(
			openModal(
				<ConfirmModal
					title={t('sessions.delete_session')}
					description={t('sessions.delete_confirm_desc', { name: session.name })}
					triggerAction={triggerAction}
					buttonText={t('sessions.delete_session')}
				/>
			)
		);
	}

	return (
		<div
			key={session.id}
			className={b({ selected: sessionIsSelected, 'multi-selected': isMultiSelected })}
			onClick={(e) => selectSession(e, session.id)}
		>
			<div className={b('info')}>
				<h4>{session.name}</h4>
				<span>{t('sessions.created')} {getDateFromNow(session.created_at)}</span>
			</div>
		</div>
	);
}
