import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';

export default function ScrollReset() {
	const location = useLocation();
	
	useEffect(() => {
		// Always reset to the top on route change.
		// Use instant to avoid visible jump animation.
		window.scrollTo({top: 0, left: 0, behavior: 'instant'} as ScrollToOptions);
	}, [location.pathname]);
	
	return null;
}
