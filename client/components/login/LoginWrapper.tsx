import React from 'react';
import Login from './login/Login';
import SignUp from './sign_up/SignUp';
import Forgot from './forgot/Forgot';
import './LoginWrapper.scss';
import Header from '../layout/header/Header';
import { useRouteMatch, Link } from 'react-router-dom';
import block from '../../styles/bem';
import { Cube } from 'phosphor-react';

const b = block('login');

export default function LoginWrapper() {
	const match = useRouteMatch();
	const path = match.path;

	let body = null;
	let currentTab = '';
	if (path.startsWith('/login')) {
		body = <Login />;
		currentTab = 'login';
	} else if (path.startsWith('/signup')) {
		body = <SignUp />;
		currentTab = 'signup';
	} else if (path.startsWith('/forgot')) {
		body = <Forgot />;
		currentTab = 'forgot';
	}

	return (
		<React.Fragment>
			<Header
				path={path}
				title={
					currentTab === 'login'
						? 'Zkt-Timer | Giriş Yap'
						: currentTab === 'signup'
							? 'Zkt-Timer | Kayıt Ol'
							: undefined
				}
			/>
			<div className={b('wrapper')}>
				{/* Background Effects */}
				<div className={b('background')}>
					{/* Gradient Orbs */}
					<div className={b('orb', { position: 'left' })} />
					<div className={b('orb', { position: 'right' })} />

					{/* Cube Pattern Overlay */}
					<div className={b('cube-pattern')}>
						{[...Array(6)].map((_, i) => (
							<div key={i} className={b('cube-float')} style={{ animationDelay: i === 0 ? '0s' : `${i * 500}ms` }}>
								<Cube size={24} weight="duotone" />
							</div>
						))}
					</div>
				</div>

				{/* Main Card */}
				<div className={b('card')}>
					{/* Logo */}
					<div className={b('logo-container')}>
						<img src="/public/images/zkt-logo.png" alt="ZKT-Timer Logo" className={b('logo')} />
					</div>

					{/* Title */}
					<h1 className={b('title')}>
						{currentTab === 'forgot' ? 'Şifreni Sıfırla' : 'Hoş Geldin'}
					</h1>

					{/* Tabs */}
					{(currentTab === 'login' || currentTab === 'signup') && (
						<div className={b('tabs')}>
							<Link to="/login" className={b('tab', { active: currentTab === 'login' })}>
								Giriş
							</Link>
							<Link to="/signup" className={b('tab', { active: currentTab === 'signup' })}>
								Kayıt Ol
							</Link>
						</div>
					)}

					{/* Form Content */}
					<div className={b('form-content')}>{body}</div>
				</div>
			</div>
		</React.Fragment>
	);
}
