import React from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Info } from 'phosphor-react';
import block from '../../../styles/bem';

const b = block('zkt-auth');

interface Props {
	/** The address the provider handed us, shown so it is obvious which account. */
	email: string | null;
	provider: 'wca' | 'zkt';
}

/**
 * Shown when signing in with a provider hits a Zkt-Timer account that already
 * exists with that email AND has a password.
 *
 * That refusal is deliberate (auto-linking on a bare email match would let
 * somebody pre-register a victim's address and inherit their identity), but it
 * used to surface as a toast that a redirect swallowed two seconds later. The
 * member was bounced back to the login form with no idea why. This screen is a
 * dead end on purpose: it names the account and gives the two steps out.
 */
export default function EmailTakenPane({ email, provider }: Props) {
	const { t } = useTranslation();
	const providerName = provider === 'zkt' ? 'Zeka Küpü Türkiye' : 'WCA';

	return (
		<div className={b('wca-conflict')}>
			<div className={b('wca-conflict-icon')}>
				<Info size={36} weight="fill" />
			</div>
			<h2 className={b('wca-conflict-title')}>{t('auth_email_taken.title')}</h2>
			<p className={b('wca-conflict-subtitle')}>
				{email
					? t('auth_email_taken.subtitle_with_email', { email })
					: t('auth_email_taken.subtitle')}
			</p>
			<p className={b('wca-conflict-description')}>
				<Trans
					i18nKey="auth_email_taken.description"
					values={{ provider: providerName }}
					components={{ strong: <strong /> }}
				/>
			</p>
			<div className={b('wca-conflict-actions')}>
				<button
					type="button"
					className={b('wca-conflict-primary')}
					onClick={() => {
						window.location.href = '/login';
					}}
				>
					{t('auth_email_taken.login_button')}
				</button>
				<button
					type="button"
					className={b('wca-conflict-secondary')}
					onClick={() => {
						window.location.href = '/forgot';
					}}
				>
					{t('auth_email_taken.forgot_button')}
				</button>
			</div>
		</div>
	);
}
