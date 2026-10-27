import React, {useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import './Landing.scss';
import block from '../../styles/bem';
import LandingNav from './common/landing_nav/LandingNav';
import SwipeBackIndicator from '../common/swipe_back_indicator/SwipeBackIndicator';
import {updateThemeColors} from '../layout/themes';
import {isLightThemePath} from '../../util/themes/theme_lock';

const b = block('landing');

export default function Landing(props: any) {
	const {children} = props;
	const {pathname} = useLocation();

	// Landing pages render outside the app shell, which is where the theme is otherwise
	// applied. /welcome wears the fixed theme (theme_lock.ts); reached from inside the
	// app, the user's colours would still be on <html> without this.
	useEffect(() => {
		updateThemeColors();
	}, [pathname]);

	return (
		<div className={b({light: isLightThemePath(pathname)})}>
			<LandingNav />
			{children}
			<SwipeBackIndicator />
		</div>
	);
}
