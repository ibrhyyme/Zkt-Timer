import React from 'react';
import { useTranslation } from 'react-i18next';
import './Session.scss';
import { getDateFromNow } from '../../../util/dates';
import { Session as SessionSchema } from '../../../../server/schemas/Session.schema';
import block from '../../../styles/bem';
import { reactState } from '../../../@types/react';
import { fetchSessionSummary } from '../../../db/solves/query';
import { getTimeString } from '../../../util/time';

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

	// A session row used to show only its name and creation date. What you
	// actually need when choosing one is how much is in it and how it is going,
	// so the row now carries count, best and mean.
	const [summary, setSummary] = React.useState(() => fetchSessionSummary(session.id));

	React.useEffect(() => {
		const refresh = () => setSummary(fetchSessionSummary(session.id));
		refresh();
		// The local solve DB is event-driven; without this the numbers would go
		// stale the moment a solve is added or deleted.
		window.addEventListener('solveDbUpdatedEvent', refresh);
		return () => window.removeEventListener('solveDbUpdatedEvent', refresh);
	}, [session.id]);

	return (
		<div
			key={session.id}
			className={b({ selected: sessionIsSelected, 'multi-selected': isMultiSelected })}
			onPointerDown={(e) => selectSession(e, session.id)}
		>
			<div className={b('info')}>
				<h4>{session.name}</h4>
				<span className={b('created-at')}>{t('sessions.created')} {getDateFromNow(session.created_at)}</span>
				<div className={b('summary')}>
					<span className={b('summary-item')}>
						{t('sessions.solve_count', {count: summary.count})}
					</span>
					{summary.best !== null && (
						<span className={b('summary-item')}>
							<em>{t('sessions.best_short')}</em> {getTimeString(summary.best)}
						</span>
					)}
					{summary.average !== null && (
						<span className={b('summary-item')}>
							<em>{t('sessions.mean_short')}</em> {getTimeString(summary.average)}
						</span>
					)}
				</div>
				<span className={b('drag-hint')}>{t('sessions.drag_to_reorder')}</span>
			</div>
		</div>
	);
}
