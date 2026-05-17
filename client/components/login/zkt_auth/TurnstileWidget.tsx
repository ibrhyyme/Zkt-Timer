import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'phosphor-react';
import block from '../../../styles/bem';

const b = block('zkt-auth');

const TURNSTILE_SITE_KEY = '0x4AAAAAAC_20JqWLYy73wqH';

interface Props {
	onToken: (token: string) => void;
}

export default function TurnstileWidget({ onToken }: Props) {
	const { t } = useTranslation();

	useEffect(() => {
		(window as any).__turnstileCallback = (token: string) => onToken(token);
		(window as any).__turnstileExpired = () => onToken('');
		(window as any).__turnstileError = () => onToken('');
		return () => {
			delete (window as any).__turnstileCallback;
			delete (window as any).__turnstileExpired;
			delete (window as any).__turnstileError;
		};
	}, [onToken]);

	return (
		<div className={b('turnstile')}>
			<span className={b('turnstile-check')}>
				<Check size={12} weight="bold" />
			</span>
			<span className={b('turnstile-label')}>{t('zkt_auth.turnstile_verified')}</span>
			<div
				className="cf-turnstile"
				data-sitekey={TURNSTILE_SITE_KEY}
				data-callback="__turnstileCallback"
				data-expired-callback="__turnstileExpired"
				data-error-callback="__turnstileError"
				data-theme="dark"
			/>
		</div>
	);
}
