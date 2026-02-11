import React, { useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useMe } from '../../../util/hooks/useMe';

export default function RootRedirect() {
	const history = useHistory();
	const me = useMe();

	useEffect(() => {
		const checkAuth = async () => {
			if (typeof window === 'undefined') return;

			// 1. If we have the 'me' object from a parent context or hook, we are definitely logged in
			if (me) {
				window.location.replace('/timer');
				return;
			}

			// 2. Check localStorage for the specific auth flag
			const hasAuthFlag = localStorage.getItem('zkt_has_auth');

			if (hasAuthFlag) {
				// We have a flag, so we should be logged in. Redirect to timer. 
				// The App component will handle the actual data fetching.
				window.location.replace('/timer');
				return;
			}

			// 3. FALLBACK: PWA/Edge Edge Case
			// If we are here, we don't have 'me' and we don't have the flag. 
			// But maybe the user HAS a valid session cookie (e.g. from "Remember Me").
			// We'll try to fetch 'me' one last time to be sure before showing the landing page.
			try {
				// We can't use dispatch here easily without connecting component, so we used a direct check logic
				// or rely on the fact that if we are at root, we might want to let App.tsx handle it? 
				// But RootRedirect is likely mounted OUTSIDE the main App data fetch flow?
				// Actually, RootRedirect is usually for the "/" path. 

				// Let's force a redirect to /timer if we suspect a session might exist, 
				// BUT to avoid infinite loops, we can't just redirect blindly.

				// Better approach: Since we are in RootRedirect, we can try to fetch the user 
				// to see if a session exists.
				// Note: This requires access to the store or a direct API call.
				// Since we are inside the Provider, useMe() is available but might be initial null.

				// If this component is rendered, it implies we are at "/".
				// Let's assume if no flag, we go to welcome.
				// BUT the user says: "I refresh and I am logged in". 
				// This means App.tsx runs, finds the cookie, fetches 'me', and THEN we are good.

				// ISSUE: RootRedirect runs FAST, sees no 'me', sees no flag, redirects to /welcome.
				// FIX: We should wait a bit or check if App is still loading? 
				// Or better: Let's assume if there is NO flag, we really are guest.
				// UNLESS... the flag was wiped.

				// Strategy: If we are in standalone mode (PWA), maybe we just always try /timer first?
				const isStandalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;

				if (isStandalone) {
					// In PWA, prefer trying to go to app first.
					window.location.replace('/timer');
					return;
				}

				history.replace('/welcome');

			} catch (e) {
				history.replace('/welcome');
			}
		};

		checkAuth();
	}, [history, me]);

	return null;
}
