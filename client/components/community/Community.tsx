import React, {ReactElement} from 'react';
import './Community.scss';
import CommunityNav from './nav/CommunityNav';
import block from '../../styles/bem';
import OfflineGuard from '../common/offline_guard/OfflineGuard';

const b = block('community');

interface Props {
	children: ReactElement;
}

export default function Community({children}: Props) {
	return (
		<div className={b()}>
			<CommunityNav />
			<OfflineGuard>{children}</OfflineGuard>
		</div>
	);
}
