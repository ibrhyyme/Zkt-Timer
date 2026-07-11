import React from 'react';
import './Account.scss';
import AccountNav from './AccountNav';
import block from '../../styles/bem';
import OfflineGuard from '../common/offline_guard/OfflineGuard';

const b = block('account');

interface Props {
	children: React.ReactNode;
}

export default function Account(props: Props) {
	return (
		<div className={b()}>
			<AccountNav />
			<OfflineGuard>
				<div>{props.children}</div>
			</OfflineGuard>
		</div>
	);
}
