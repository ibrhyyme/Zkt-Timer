import React from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Warning } from 'phosphor-react';
import block from '../../../styles/bem';

const b = block('zkt-auth');

interface Props {
	ownerUsername: string | null;
	/** Which provider's account is already taken. Layout is identical. */
	provider?: 'wca' | 'zkt';
}

export default function WcaConflictPane({ ownerUsername, provider = 'wca' }: Props) {
	const { t } = useTranslation();
	const ns = provider === 'zkt' ? 'zkt_auth.zkt_conflict' : 'zkt_auth.wca_conflict';

	return (
		<div className={b('wca-conflict')}>
			<div className={b('wca-conflict-icon')}>
				<Warning size={36} weight="fill" />
			</div>
			<h2 className={b('wca-conflict-title')}>{t(`${ns}.title`)}</h2>
			<p className={b('wca-conflict-subtitle')}>{t(`${ns}.subtitle`)}</p>
			<p className={b('wca-conflict-description')}>
				{ownerUsername ? (
					<Trans
						i18nKey={`${ns}.description_with_username`}
						values={{ username: ownerUsername }}
						components={{ strong: <strong /> }}
					/>
				) : (
					t(`${ns}.description_no_username`)
				)}
			</p>
			<div className={b('wca-conflict-actions')}>
				<button
					type="button"
					className={b('wca-conflict-primary')}
					onClick={() => {
						window.location.href = '/login';
					}}
				>
					{t(`${ns}.go_to_other_account_button`)}
				</button>
				<button
					type="button"
					className={b('wca-conflict-secondary')}
					onClick={() => {
						window.location.href = '/account/linked-accounts';
					}}
				>
					{t(`${ns}.cancel_button`)}
				</button>
			</div>
		</div>
	);
}
