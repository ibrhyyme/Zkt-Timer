import React from 'react';
import './TopNav.scss';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
const b = block('top-nav');

interface Props {
	white?: boolean;
}

export default function TopNav(props: Props) {
	const {white} = props;

	return (
		<div
			className={b({
				white,
			})}
		>
			<div className={b('body')}>
				<div className={b('logo')}>
					<a href="/">
						<div className="logo-placeholder" />
					</a>
				</div>

				<div className={b('links')}>
					<Button large textColor={white ? '#444444' : null} to="/login" text="Giriş Yap" transparent />
					<Button large primary to="/signup" text="Kayıt Ol" />
				</div>
			</div>
		</div>
	);
}
