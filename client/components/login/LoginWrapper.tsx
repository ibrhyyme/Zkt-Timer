import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import Login from './login/Login';
import SignUp from './sign_up/SignUp';
import Forgot from './forgot/Forgot';
import EmailVerification from './email_verification/EmailVerification';
import WcaSignup from './wca_signup/WcaSignup';
import './LoginWrapper.scss';
import Header from '../layout/header/Header';
import { useRouteMatch, Link } from 'react-router-dom';
import block from '../../styles/bem';
import { Cube } from 'phosphor-react';
import LanguageSwitcher from '../common/language_switcher/LanguageSwitcher';
import SplitText from '../common/split_text/SplitText';

const b = block('login');

export default function LoginWrapper() {
	const { t } = useTranslation();
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
	} else if (path.startsWith('/verify-email')) {
		body = <EmailVerification />;
		currentTab = 'verify';
	} else if (path.startsWith('/wca-signup')) {
		body = <WcaSignup />;
		currentTab = 'wca-signup';
	}

	const titleText = currentTab === 'forgot'
		? t('login_wrapper.reset_password')
		: currentTab === 'verify'
			? t('email_verification.title')
			: currentTab === 'wca-signup'
				? t('wca_signup.title')
				: t('login_wrapper.welcome');

	return (
		<React.Fragment>
			<Header
				path={path}
				title={
					currentTab === 'login'
						? t('login_wrapper.login_title')
						: currentTab === 'signup'
							? t('login_wrapper.signup_title')
							: undefined
				}
			/>
			<div className={b('wrapper')}>
				{/* Language Switcher */}
				<div className={b('lang-switcher')}>
					<LanguageSwitcher />
				</div>

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

					{/* Title — SplitText stagger animation */}
					<h1 className={b('title')}>
						<SplitText key={titleText} text={titleText} delay={0.15} />
					</h1>

					{/* Tabs */}
					{(currentTab === 'login' || currentTab === 'signup') && (
						<div className={b('tabs')}>
							<Link to="/login" className={b('tab', { active: currentTab === 'login' })}>
								{t('login_wrapper.login')}
							</Link>
							<Link to="/signup" className={b('tab', { active: currentTab === 'signup' })}>
								{t('login_wrapper.signup')}
							</Link>
						</div>
					)}

					{/* Form Content — animated tab transitions */}
					<div className={b('form-content')}>
						<AnimatePresence exitBeforeEnter initial={false}>
							<motion.div
								key={currentTab}
								initial={{ opacity: 0, y: 12 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -12 }}
								transition={{ duration: 0.25, ease: 'easeInOut' }}
							>
								{body}
							</motion.div>
						</AnimatePresence>
					</div>
				</div>
			</div>
		</React.Fragment>
	);
}
