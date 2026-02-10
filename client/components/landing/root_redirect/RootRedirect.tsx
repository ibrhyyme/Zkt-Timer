import React, { useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useMe } from '../../../util/hooks/useMe';

export default function RootRedirect() {
	const history = useHistory();
	const me = useMe();

	useEffect(() => {
		const hasAuth = typeof window !== 'undefined' && localStorage.getItem('zkt_has_auth');

		if (hasAuth || me) {
			window.location.replace('/timer');
		} else {
			history.replace('/welcome');
		}
	}, [history, me]);

	return null;
}
