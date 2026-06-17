import React, { useEffect, useState } from 'react';
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
	// Reflects Cloudflare's real verification state — only the success callback flips this true.
	const [verified, setVerified] = useState(false);

	useEffect(() => {
		(window as any).__turnstileCallback = (token: string) => {
			setVerified(true);
			onToken(token);
		};
		(window as any).__turnstileExpired = () => {
			setVerified(false);
			onToken('');
		};
		(window as any).__turnstileError = () => {
			setVerified(false);
			onToken('');
		};
		return () => {
			delete (window as any).__turnstileCallback;
			delete (window as any).__turnstileExpired;
			delete (window as any).__turnstileError;
		};
	}, [onToken]);

	return (
		<div className={b('turnstile')}>
			{verified && (
				<span className={b('turnstile-check')}>
					<Check size={12} weight="bold" />
				</span>
			)}
			<span className={b('turnstile-label')}>
				{verified ? t('zkt_auth.turnstile_verified') : t('zkt_auth.turnstile_verify')}
			</span>
			{/* Keep the widget mounted (hidden) once verified so Cloudflare's instance
			    isn't torn down; on expiry/error verified flips back and it reappears. */}
			<div
				className="cf-turnstile"
				style={verified ? { display: 'none' } : undefined}
				data-sitekey={TURNSTILE_SITE_KEY}
				data-callback="__turnstileCallback"
				data-expired-callback="__turnstileExpired"
				data-error-callback="__turnstileError"
				data-theme="dark"
			/>
		</div>
	);
}
