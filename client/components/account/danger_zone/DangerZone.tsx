import React from 'react';
import {useTranslation} from 'react-i18next';
import { gql } from '@apollo/client/core';
import { gqlMutate } from '../../api';
import Button from '../../common/button/Button';
import { toastError } from '../../../util/toast';
import { deleteLocalStorage } from '../../../util/data/local_storage';
import { clearOfflineData } from '../../layout/offline';
import { clearAllSolveTombstones } from '../../../util/solve-tombstones';
import { ArrowCounterClockwise, Trash } from 'phosphor-react';
import SettingsCard from '../common/settings_card/SettingsCard';
import block from '../../../styles/bem';
import './DangerZone.scss';

const b = block('danger-zone');

export default function DangerZone() {
	const {t} = useTranslation();

	async function resetSettings() {
		const query = gql`
			mutation Mutate {
				resetSettings {
					id
				}
			}
		`;

		try {
			await gqlMutate(query);
			window.location.reload();
		} catch (e) {
			toastError(e.message);
		}
	}

	async function deleteAccount() {
		const query = gql`
			mutation Mutate {
				deleteUserAccount {
					id
				}
			}
		`;

		await gqlMutate(query);
		deleteLocalStorage('wasBasicUser');
		deleteLocalStorage('offlineHash');
		clearAllSolveTombstones();
		try { await clearOfflineData(); } catch (e) { /* ignore */ }
		window.location.href = '/';
	}

	return (
		<>
			{/* Resetting settings is not destructive to data, but it is not a "safe green"
			    action either — it throws away every preference. Amber, not green. */}
			<SettingsCard
				warning
				title={t('danger_zone.reset_settings_title')}
				icon={<ArrowCounterClockwise weight="bold" />}
				footer={
					<Button
						warning
						large
						text={t('danger_zone.reset_settings_button')}
						confirmModalProps={{
							title: t('danger_zone.reset_settings_confirm_title'),
							description: t('danger_zone.reset_settings_confirm_desc'),
							triggerAction: resetSettings,
							buttonText: t('danger_zone.reset_settings_button'),
						}}
					/>
				}
			>
				<p
					className={b('text')}
					dangerouslySetInnerHTML={{__html: t('danger_zone.reset_settings_desc')}}
				/>
			</SettingsCard>

			<SettingsCard
				danger
				title={t('danger_zone.delete_account_title')}
				icon={<Trash weight="fill" />}
				footer={
					<Button
						danger
						large
						glow
						text={t('danger_zone.delete_account_button')}
						confirmModalProps={{
							title: t('danger_zone.delete_account_title'),
							description: t('danger_zone.delete_account_confirm_desc'),
							triggerAction: deleteAccount,
							buttonText: t('danger_zone.delete_account_confirm_button'),
						}}
					/>
				}
			>
				<p className={b('text')}>{t('danger_zone.delete_account_warning')}</p>
			</SettingsCard>
		</>
	);
}
