import React from 'react';
import { useTranslation } from 'react-i18next';
import './Session.scss';
import { getDateFromNow } from '../../../util/dates';
import { Session as SessionSchema } from '../../../../server/schemas/Session.schema';
import block from '../../../styles/bem';
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
	const { t } = useTranslation();

	const { session, selectedSessionId, selectSession, isMultiSelected } = props;

	const sessionIsSelected = selectedSessionId === session.id;

	return (
		<div
			key={session.id}
			className={b({ selected: sessionIsSelected, 'multi-selected': isMultiSelected })}
			onPointerDown={(e) => selectSession(e, session.id)}
		>
			<div className={b('info')}>
				<h4>{session.name}</h4>
				<span className={b('created-at')}>{t('sessions.created')} {getDateFromNow(session.created_at)}</span>
				<span className={b('drag-hint')}>{t('sessions.drag_to_reorder')}</span>
			</div>
		</div>
	);
}
