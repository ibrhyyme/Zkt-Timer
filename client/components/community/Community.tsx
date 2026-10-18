import React, {ReactElement} from 'react';
import {useLocation} from 'react-router-dom';
import './Community.scss';
import CommunityNav from './nav/CommunityNav';
import block from '../../styles/bem';
import OfflineGuard from '../common/offline_guard/OfflineGuard';

const b = block('community');

interface Props {
	children: ReactElement;
}

// The competition list and a competition's own pages draw the copy kept on the
// device (competition-cache) and handle a missing connection themselves: they
// show what they have and retry. A competitor at the venue with no signal still
// sees their groups and schedule. Record radar and the federation-native ZKT
// pages have no such fallback and keep the offline notice.
function worksOffline(pathname: string): boolean {
	return /^\/competitions(\/(?!records(\/|$))[^/]+.*)?\/?$/.test(pathname);
}

export default function Community({children}: Props) {
	const {pathname} = useLocation();
	return (
		<div className={b()}>
			<CommunityNav />
			{worksOffline(pathname) ? children : <OfflineGuard>{children}</OfflineGuard>}
		</div>
	);
}
