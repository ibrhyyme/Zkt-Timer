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
	inline?: boolean;
}

export default function PageTitle(props: Props) {
	const { pageName, children, icon, inline } = props;

	let iconBody = null;
	if (icon) {
		iconBody = <i className={icon} />;
	}

	return (
		<div className={b({ inline: !!inline })}>
			<h1 className={b('title')}>
				<span className={b('title-text')}>
					{iconBody}
					{pageName}
				</span>
				<div className={b('mobile-cluster')}>
					<MobileNav />
					<div className="zt-page-title--account-dropdown-mobile">
						<AccountDropdown />
					</div>
				</div>
			</h1>

			{children ? <div className={b('content')}>{children}</div> : null}
		</div>
	);
}
