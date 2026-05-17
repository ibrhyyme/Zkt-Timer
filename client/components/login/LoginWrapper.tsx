import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRouteMatch } from 'react-router-dom';
import Header from '../layout/header/Header';
import Forgot from './forgot/Forgot';
import EmailVerification from './email_verification/EmailVerification';
import WcaSignup from './wca_signup/WcaSignup';
import ZktAuthScene from './zkt_auth/ZktAuthScene';
import { AuthMode } from './zkt_auth/AuthCard';

export default function LoginWrapper() {
	const { t } = useTranslation();
	const match = useRouteMatch();
	const path = match.path;

	let mode: AuthMode;
	let legacyChild: React.ReactNode = null;
	let legacyTitle: string | undefined;
	let headerTitle: string | undefined;

	if (path.startsWith('/login')) {
		mode = 'login';
		headerTitle = t('login_wrapper.login_title');
	} else if (path.startsWith('/signup')) {
		mode = 'signup';
		headerTitle = t('login_wrapper.signup_title');
	} else if (path.startsWith('/forgot')) {
		mode = 'legacy';
		legacyChild = <Forgot />;
		legacyTitle = t('login_wrapper.reset_password');
	} else if (path.startsWith('/verify-email')) {
		mode = 'legacy';
		legacyChild = <EmailVerification />;
		legacyTitle = t('login_wrapper.verify_email');
	} else if (path.startsWith('/wca-signup')) {
		mode = 'legacy';
		legacyChild = <WcaSignup />;
		legacyTitle = t('wca_signup.title');
	} else {
		mode = 'login';
	}

	return (
		<React.Fragment>
			<Header path={path} title={headerTitle} />
			<ZktAuthScene
				initialMode={mode}
				legacyChild={legacyChild}
				legacyTitle={legacyTitle}
			/>
		</React.Fragment>
	);
}
