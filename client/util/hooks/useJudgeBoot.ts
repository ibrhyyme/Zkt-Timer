import {useEffect} from 'react';
import {useHistory, useLocation} from 'react-router-dom';
import {startJudgeOutbox} from '../judge-outbox-device';
import {judgeResumePath} from '../judge-session';

/**
 * Online score entry, at app start: send what the judge typed before the app
 * closed, and take them back to their entry card. Both are no-ops for a member
 * who is not judging (an empty outbox, no marker on the device).
 */
export function useJudgeBoot(userId: string | null | undefined, appLoaded: boolean): void {
	const history = useHistory();
	const location = useLocation();

	useEffect(() => {
		if (!userId || !appLoaded) return;
		startJudgeOutbox();
		// Not cancelled on unmount: App remounts on every route change (the start
		// page redirects once on boot), and the router this history belongs to
		// outlives those mounts. The check itself runs once per app start.
		judgeResumePath(userId, location.pathname)
			.then((path) => {
				if (path) history.replace(path);
			})
			.catch(() => {});
		// The pathname is read once on purpose.
	}, [userId, appLoaded]);
}
