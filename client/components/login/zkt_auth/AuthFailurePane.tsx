import React from 'react';
import { useTranslation } from 'react-i18next';
import { WarningCircle } from 'phosphor-react';
import block from '../../../styles/bem';

const b = block('zkt-auth');

interface Props {
	/** Raw reason from the server or the flow. Shown verbatim — see below. */
	detail: string | null;
	provider: 'wca' | 'zkt';
}

/**
 * Terminal error screen for a provider sign-in that failed for a reason we have
 * no specific screen for.
 *
 * It exists because the previous behaviour was a toast plus a redirect to
 * /login two seconds later: the member saw the flow bounce them back to the
 * start with no explanation, and neither they nor anyone helping them could say
 * what went wrong. A dead end that names the reason is strictly better than a
 * silent loop.
 *
 * `detail` is rendered as-is on purpose. These strings come from our own server
 * (an ApolloError message) and are the only thing that makes a bug report
 * actionable; hiding them behind "something went wrong" is what created this
 * problem in the first place.
 */
export default function AuthFailurePane({ detail, provider }: Props) {
	const { t } = useTranslation();
	const providerName = provider === 'zkt' ? 'Zeka Küpü Türkiye' : 'WCA';

	return (
		<div className={b('wca-conflict')}>
			<div className={b('wca-conflict-icon')}>
				<WarningCircle size={36} weight="fill" />
			</div>
			<h2 className={b('wca-conflict-title')}>
				{t('auth_failure.title', { provider: providerName })}
			</h2>
			<p className={b('wca-conflict-subtitle')}>{t('auth_failure.subtitle')}</p>
			{detail && (
				<p
					className={b('wca-conflict-description')}
					style={{
						fontFamily: 'monospace',
						fontSize: '0.8rem',
						wordBreak: 'break-word',
						textAlign: 'left',
					}}
				>
					{detail}
				</p>
			)}
			<div className={b('wca-conflict-actions')}>
				<button
					type="button"
					className={b('wca-conflict-primary')}
					onClick={() => {
						window.location.href = '/login';
					}}
				>
					{t('auth_failure.retry_button')}
				</button>
			</div>
		</div>
	);
}
