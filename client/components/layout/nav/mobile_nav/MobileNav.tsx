import React from 'react';
import './MobileNav.scss';
import {useRouteMatch} from 'react-router-dom';
import BottomSheetNav from '../bottom_sheet_nav/BottomSheetNav';

export default function MobileNav() {
	const match = useRouteMatch();
	const isTimerPage = /(^\/$|^$|^\/timer)/.test(match.path);

	if (isTimerPage) return null;

	return <BottomSheetNav />;
}
