// Offers to move solves made before signing up into the new account.
//
// Triggered by state, not by the signup event: signup ends in a full-page redirect
// to /verify-email, so there is no moment in the session to hook. Instead this asks
// whenever a signed-in boot finds solves sitting in the anonymous database.

import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import './AnonTransferPrompt.scss';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import {useMe} from '../../../util/hooks/useMe';
import {getAnonSolveCount, readAnonSnapshot, deleteAnonData, clearAnonSolveCount} from '../../../util/anon-mode';
import {
	importSolvesInChunks,
	importSessionsInChunks,
} from '../../settings/data/import_data/review_import/chunked_import';
import {getSolveDb} from '../../../db/solves/init';
import {getSessionDb} from '../../../db/sessions/init';
import {emitEvent} from '../../../util/event_handler';

const b = block('anon-transfer');

type Phase = 'ask' | 'working' | 'partial';

export default function AnonTransferPrompt() {
	const {t} = useTranslation();
	const me = useMe();

	const [count, setCount] = useState(0);
	const [phase, setPhase] = useState<Phase>('ask');
	const [progress, setProgress] = useState(0);
	const [hidden, setHidden] = useState(false);

	// Read after mount: localStorage does not exist during SSR, and reading it in
	// render would desync hydration.
	useEffect(() => {
		setCount(getAnonSolveCount());
	}, [me]);

	if (!me || hidden || count <= 0) return null;

	async function transfer() {
		setPhase('working');

		const snapshot = await readAnonSnapshot();
		if (!snapshot || snapshot.solves.length === 0) {
			// Counter outlived the data (cleared site data, another tab): drop it and
			// stop asking rather than showing an error for something already gone.
			clearAnonSolveCount();
			setHidden(true);
			return;
		}

		// Sessions first: a solve whose session does not exist yet would land nowhere.
		const sessionResult = await importSessionsInChunks(snapshot.sessions as any, () => {});
		const solveResult = await importSolvesInChunks(snapshot.solves as any, (p) => {
			setProgress(p.percentComplete);
		});

		const failed = sessionResult.failureCount > 0 || solveResult.failureCount > 0;
		if (failed) {
			// The local copy is the only copy. Keep it and let them retry later.
			setPhase('partial');
			return;
		}

		// Mirror the transferred rows into the account's open database so the page
		// reflects them without a reload.
		try {
			const sessionDb = getSessionDb();
			const solveDb = getSolveDb();
			for (const session of snapshot.sessions) {
				if (sessionDb && !sessionDb.findOne({id: session.id})) sessionDb.insert(session);
			}
			for (const solve of snapshot.solves) {
				if (solveDb && !solveDb.findOne({id: solve.id})) solveDb.insert(solve);
			}
			emitEvent('solveDbUpdatedEvent');
			emitEvent('sessionsDbUpdatedEvent');
		} catch {
			// Cosmetic only — the server already has the data, a reload would show it.
		}

		await deleteAnonData();
		setHidden(true);
	}

	function keepLocal() {
		// No counter reset: the offer returns on the next boot, because the data is
		// still only on this device.
		setHidden(true);
	}

	return (
		<div className={b()}>
			<div className={b('card')}>
				<h2 className={b('title')}>{t('anon.transfer_title')}</h2>

				{phase === 'partial' ? (
					<>
						<p className={b('body')}>{t('anon.transfer_partial')}</p>
						<div className={b('actions')}>
							<Button primary text={t('anon.transfer_close')} onClick={() => setHidden(true)} />
						</div>
					</>
				) : (
					<>
						<p className={b('body')}>{t('anon.transfer_body', {count})}</p>

						{phase === 'working' ? (
							<div className={b('progress')}>
								<div className={b('progress-bar')} style={{width: `${progress}%`}} />
							</div>
						) : null}

						<div className={b('actions')}>
							<Button
								primary
								text={phase === 'working' ? t('anon.transfer_working') : t('anon.transfer_confirm')}
								disabled={phase === 'working'}
								onClick={transfer}
							/>
							{phase === 'ask' ? (
								<Button flat text={t('anon.transfer_cancel')} onClick={keepLocal} />
							) : null}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
