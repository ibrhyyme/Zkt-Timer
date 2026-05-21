import React from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Warning } from 'phosphor-react';
import block from '../../../styles/bem';

const b = block('zkt-auth');

interface Props {
	ownerUsername: string | null;
}

export default function WcaConflictPane({ ownerUsername }: Props) {
	const { t } = useTranslation();

	return (
		<div className={b('wca-conflict')}>
			<div className={b('wca-conflict-icon')}>
				<Warning size={36} weight="fill" />
			</div>
			<h2 className={b('wca-conflict-title')}>{t('zkt_auth.wca_conflict.title')}</h2>
			<p className={b('wca-conflict-subtitle')}>{t('zkt_auth.wca_conflict.subtitle')}</p>
			<p className={b('wca-conflict-description')}>
				{ownerUsername ? (
					<Trans
						i18nKey="zkt_auth.wca_conflict.description_with_username"
						values={{ username: ownerUsername }}
						components={{ strong: <strong /> }}
					/>
				) : (
					t('zkt_auth.wca_conflict.description_no_username')
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
					{t('zkt_auth.wca_conflict.go_to_other_account_button')}
				</button>
				<button
					type="button"
					className={b('wca-conflict-secondary')}
					onClick={() => {
						window.location.href = '/account/linked-accounts';
					}}
				>
					{t('zkt_auth.wca_conflict.cancel_button')}
				</button>
			</div>
		</div>
	);
}
