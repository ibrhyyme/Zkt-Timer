import React from 'react';
import {useTranslation} from 'react-i18next';
import { gql } from '@apollo/client/core';
import { gqlMutate } from '../../api';
import Button from '../../common/button/Button';
import { toastError } from '../../../util/toast';

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
		window.location.href = '/';
	}

	return (
		<div>
			<div className="mb-8 border border-green-500/30 bg-green-500/10 rounded-xl p-6">
				<h3 className="text-xl font-bold text-green-400 mb-2">{t('danger_zone.reset_settings_title')}</h3>
				<p className="text-gray-300 mb-4" dangerouslySetInnerHTML={{ __html: t('danger_zone.reset_settings_desc') }} />
				<Button
					success
					text={t('danger_zone.reset_settings_button')}
					confirmModalProps={{
						title: t('danger_zone.reset_settings_confirm_title'),
						description: t('danger_zone.reset_settings_confirm_desc'),
						triggerAction: resetSettings,
						buttonText: t('danger_zone.reset_settings_button'),
					}}
				/>
			</div>

			<p>
				{t('danger_zone.delete_account_warning')}
			</p>
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
		</div>
	);
}
