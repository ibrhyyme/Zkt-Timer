import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretDown } from 'phosphor-react';
import { useDispatch } from 'react-redux';
import ImportData, { ImportDataType } from './import_data/ImportData';
import fileDownload from 'js-file-download';
import { gql } from '@apollo/client/core';
import { gqlMutate, removeTypename } from '../../api';
import { openModal } from '../../../actions/general';
import { fetchSessions } from '../../../db/sessions/query';
import { fetchSolves } from '../../../db/solves/query';
import { toastError, toastSuccess } from '../../../util/toast';
import SettingRow from '../setting/row/SettingRow';
import Dropdown from '../../common/inputs/dropdown/Dropdown';
import Button, { CommonType } from '../../common/button/Button';
import { clearOfflineData } from '../../layout/offline';

export default function DataSettings() {
	const { t } = useTranslation();
	const dispatch = useDispatch();

	const [exportingData, setExportingData] = useState(false);

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

	function openImportModal(importType: ImportDataType) {
		dispatch(openModal(<ImportData importType={importType} />));
	}

	async function hardReload() {
		try {
			await clearOfflineData();
			window.location.reload();
		} catch (e) {
			console.error(e);
		}
	}

	async function exportData() {
		setExportingData(true);

		const sessions = fetchSessions().map((s) => removeTypename({ ...s }, true));
		const solves = fetchSolves({
			from_timer: true,
		}).map((s) => removeTypename({ ...s }, true));

		const data = JSON.stringify({
			sessions,
			solves,
		});

		const filename = `zkttimer_data_${new Date().toLocaleString().replace(/,\s|\s|\/|:|_/g, '_')}.txt`;

		fileDownload(data, filename);

		setExportingData(false);
		toastSuccess(t('data_settings.export_success'));
	}

	return (
		<>
			<SettingRow
				loggedInOnly
				title={t('data_settings.force_reload')}
				description={t('data_settings.force_reload_desc')}
			>
				<Button theme={CommonType.GRAY} text={t('data_settings.force_reload_button')} onClick={hardReload} />
			</SettingRow>
			<SettingRow
				loggedInOnly
				title={t('data_settings.export_data')}
				description={t('data_settings.export_data_desc')}
			>
				<Button theme={CommonType.GRAY} loading={exportingData} text={t('data_settings.export_button')} onClick={exportData} />
			</SettingRow>
			<SettingRow loggedInOnly title={t('data_settings.import_data')} description={t('data_settings.import_data_desc')}>
				<Dropdown
					text={t('data_settings.import_button')}
					icon={<CaretDown weight="bold" />}
					options={[
						{ text: t('data_settings.import_cstimer'), onClick: () => openImportModal(ImportDataType.CS_TIMER) },
						{ text: t('data_settings.import_zkttimer'), onClick: () => openImportModal(ImportDataType.ZKT_TIMER) },
					]}
				/>
			</SettingRow>
			<SettingRow
				loggedInOnly
				title={t('data_settings.reset_settings')}
				description={t('data_settings.reset_settings_desc')}
			>
				<Button
					theme={CommonType.DANGER}
					text={t('data_settings.reset_settings_button')}
					confirmModalProps={{
						description: t('data_settings.reset_settings_confirm_desc'),
						title: t('data_settings.reset_settings'),
						buttonText: t('data_settings.reset_settings_button'),
						triggerAction: resetSettings,
					}}
				/>
			</SettingRow>
		</>
	);
}
