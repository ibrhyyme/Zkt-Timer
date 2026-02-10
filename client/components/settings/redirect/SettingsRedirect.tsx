import React, {useEffect} from 'react';
import {useDispatch} from 'react-redux';
import {useHistory} from 'react-router-dom';
import {setGeneral} from '../../../actions/general';

export default function SettingsRedirect() {
	const dispatch = useDispatch();
	const history = useHistory();

	useEffect(() => {
		// Modal'ı aç
		dispatch(setGeneral('settings_modal_open', true));

		// Ana sayfaya yönlendir (modal arka planda açılır)
		history.replace('/');
	}, [dispatch, history]);

	// Boş component - redirect yapılırken hiçbir şey render etme
	return null;
}
