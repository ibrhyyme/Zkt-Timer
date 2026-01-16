import React, { ReactNode } from 'react';
import './PageTitle.scss';
import block from '../../../styles/bem';
import MobileNav from '../../layout/nav/mobile_nav/MobileNav';
import AccountDropdown from '../../layout/nav/account_dropdown/AccountDropdown';

const b = block('page-title');

interface Props {
	pageName: string;
	children?: ReactNode;
	icon?: string;
}

export default function PageTitle(props: Props) {
	const { pageName, children, icon } = props;

	let iconBody = null;
	if (icon) {
		iconBody = <i className={icon} />;
	}

	return (
		<div className={b()}>
			<h1 className={b('title')}>
				{iconBody}
				{pageName}
				<div style={{ marginLeft: '12px', display: 'flex', alignItems: 'center' }}>
					<MobileNav />
					<div className="cd-page-title--account-dropdown-mobile">
						<AccountDropdown />
					</div>
				</div>
			</h1>
			<div className={b('lines')}>
				<div className={b('line')} />
				<div className={b('line', { secondary: true })} />
			</div>

			{children}
		</div>
	);
}
