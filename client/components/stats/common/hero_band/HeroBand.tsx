import React, {ReactNode} from 'react';
import './HeroBand.scss';
import block from '../../../../styles/bem';
import MobileNav from '../../../layout/nav/mobile_nav/MobileNav';
import AccountDropdown from '../../../layout/nav/account_dropdown/AccountDropdown';

const b = block('stats-hero');

interface Props {
	title: string;
	subtitle?: string;
	children?: ReactNode;
}

export default function HeroBand(props: Props) {
	const {title, subtitle, children} = props;

	return (
		<div className={b()}>
			<div className={b('top')}>
				<div className={b('text')}>
					<h1 className={b('title')}>
						{title}
						<span className={b('mobile-cluster')}>
							<MobileNav />
							<span className={b('account-dropdown-mobile')}>
								<AccountDropdown />
							</span>
						</span>
					</h1>
					{subtitle ? <p className={b('subtitle')}>{subtitle}</p> : null}
					<div className={b('lines')}>
						<div className={b('line')} />
						<div className={b('line', {secondary: true})} />
					</div>
				</div>
				{children ? <div className={b('filters')}>{children}</div> : null}
			</div>
		</div>
	);
}
