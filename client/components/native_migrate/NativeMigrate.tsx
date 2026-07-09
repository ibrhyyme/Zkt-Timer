import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';

// One-time data bridge page for the Faz 2 origin switch (see client/util/native-migrate.ts).
//
// Runs on the OLD origin (https://zktimer.app) INSIDE the app's WebView after the
// local shell navigated here — the only context that can read the old IndexedDB and
// localStorage. Exports the anonymous data, stashes it server-side under the mid the
// shell generated, then returns with history.back().
//
// NOTE: no Capacitor bridge exists on this page (remote page in a local-shell app),
// so app detection uses the ZktTimerApp UA marker, never isNative().
const MAX_SOLVES = 5000;
const LS_KEYS = ['settings', 'zkt_theme', 'zkt_language'];

async function exportOldOriginData(): Promise<Record<string, any>> {
	const localStorageOut: Record<string, string> = {};
	for (const key of LS_KEYS) {
		const value = localStorage.getItem(key);
		if (value) {
			localStorageOut[key] = value;
		}
	}

	// Logged-in old context: solves/sessions live server-side, ship only the
	// lightweight localStorage extras.
	if (localStorage.getItem('zkt_has_auth')) {
		return {local_storage: localStorageOut};
	}

	const {initLokiDb, getLokiDb, stripLokiJsMetadata} = await import('../../db/lokijs');
	initLokiDb();
	await new Promise<void>((resolve) => getLokiDb().loadDatabase({}, () => resolve()));

	const solveCollection = getLokiDb().getCollection('solves');
	const sessionCollection = getLokiDb().getCollection('sessions');

	// Newest first, capped: keeps the payload within the server body limit even for
	// heavy anonymous users.
	const solves = (solveCollection ? solveCollection.chain().simplesort('started_at', true).limit(MAX_SOLVES).data() : []).map(
		stripLokiJsMetadata
	);
	const sessions = (sessionCollection ? sessionCollection.find() : []).map(stripLokiJsMetadata);

	return {solves, sessions, local_storage: localStorageOut};
}

export default function NativeMigrate() {
	const {t} = useTranslation();
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		const mid = new URLSearchParams(window.location.search).get('mid') || '';
		const isApp = typeof navigator !== 'undefined' && navigator.userAgent.includes('ZktTimerApp');

		if (!isApp || !/^[a-f0-9]{32}$/.test(mid)) {
			// Opened outside the bridge flow (crawler, curious user): nothing to do here.
			window.location.replace('/');
			return;
		}

		(async () => {
			try {
				const payload = await exportOldOriginData();
				const res = await fetch('/api/native-migrate/stash', {
					method: 'POST',
					credentials: 'same-origin',
					headers: {'Content-Type': 'application/json'},
					body: JSON.stringify({mid, payload}),
				});
				if (!res.ok) {
					setFailed(true);
				}
			} catch (e) {
				setFailed(true);
			}
			// Return to the shell either way: it consumes the stash or gives up after
			// its attempt budget. Small delay so the POST settles.
			setTimeout(() => window.history.back(), 400);
		})();
	}, []);

	return (
		<div
			style={{
				minHeight: '100vh',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				gap: '20px',
				background: '#12141C',
				color: '#ffffff',
				padding: '2rem',
				textAlign: 'center',
			}}
		>
			<span style={{fontSize: '1.05rem', fontWeight: 600}}>
				{failed ? t('common.native_migrate_back') : t('common.native_migrate_title')}
			</span>
			<button
				type="button"
				onClick={() => window.history.back()}
				style={{
					backgroundColor: '#6C63FF',
					color: '#ffffff',
					border: 'none',
					padding: '0.85rem 2.25rem',
					borderRadius: '10px',
					fontSize: '1rem',
					fontWeight: 600,
					cursor: 'pointer',
				}}
			>
				{t('common.native_migrate_back')}
			</button>
		</div>
	);
}
