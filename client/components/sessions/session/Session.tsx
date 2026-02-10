import React from 'react';
import { useDispatch } from 'react-redux';
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
}

export default function Session(props: Props) {
	const currentSessionId = useSettings('session_id');
	const dispatch = useDispatch();

	const { session, selectedSessionId, selectSession } = props;

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
					title="Merge sessions"
					description={`Be careful here. You are about to merge "${session.name}" into "${currentSession.name}". "${session.name}" will be deleted after the merge.`}
					triggerAction={async () => {
						await mergeSessionsDb(session.id, currentSessionId);
						props.setSelectedSessionId(currentSessionId);
					}}
					buttonText="Merge sessions"
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
					name: 'Yeni Sezon',
					id: newId,
				});

				setCurrentSession(newId);
				setCubeType('333');

				updatedSessionId = newId;
			}

			props.setSelectedSessionId(updatedSessionId);
			await deleteSessionDb(session);
			toastSuccess(`"${name}" sezonu başarıyla silindi`);
		}

		dispatch(
			openModal(
				<ConfirmModal
					title="Sezonu sil"
					description={`Dikkatli olun. "${session.name}" sezonunu silmek üzeresiniz. Bu işlem geri alınamaz.`}
					triggerAction={triggerAction}
					buttonText="Sezonu sil"
				/>
			)
		);
	}

	return (
		<div
			key={session.id}
			className={b({ selected: sessionIsSelected })}
			onClick={(e) => selectSession(e, session.id)}
		>
			<div className={b('info')}>
				<h4>{session.name}</h4>
				<span>Oluşturuldu {getDateFromNow(session.created_at)}</span>
			</div>
		</div>
	);
}
