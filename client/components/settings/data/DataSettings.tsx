import React, { useState } from 'react';
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
		toastSuccess('Tüm çözüm ve oturum verileri başarıyla indirildi.');
	}

	return (
		<>
			<SettingRow
				loggedInOnly
				title="Zorla yeniden yükle"
				description="Verileriniz veya ayarlarınız senkronize değilse, veritabanıyla yeniden senkronize etmek için zorla yeniden yükleme yapabilirsiniz."
			>
				<Button theme={CommonType.GRAY} text="Zorla yeniden yükle" onClick={hardReload} />
			</SettingRow>
			<SettingRow
				loggedInOnly
				title="Çözüm ve oturum verilerini dışa aktar"
				description="Bu veriler, gerektiğinde daha sonra içe aktarılabilecek çözüm ve oturum verileriniz için yedek görevi görebilir."
			>
				<Button theme={CommonType.GRAY} loading={exportingData} text="Verileri dışa aktar" onClick={exportData} />
			</SettingRow>
			<SettingRow loggedInOnly title="Veri içe aktar" description="csTimer veya Zkt-Timer'dan veri içe aktarın">
				<Dropdown
					text="Veri içe aktar"
					icon={<CaretDown weight="bold" />}
					options={[
						{ text: 'csTimer\'dan içe aktar', onClick: () => openImportModal(ImportDataType.CS_TIMER) },
						{ text: 'Zkt-Timer Yedekten içe aktar', onClick: () => openImportModal(ImportDataType.ZKT_TIMER) },
					]}
				/>
			</SettingRow>
			<SettingRow
				loggedInOnly
				title="Ayarları sıfırla"
				description="Ayarlardaki her şeyi varsayılan değerlere sıfırla (özel küp türleri hariç)"
			>
				<Button
					theme={CommonType.DANGER}
					text="Ayarları sıfırla"
					confirmModalProps={{
						description:
							'Dikkatli olun. Ayarlarınızı varsayılan değerlere sıfırlamak üzeresiniz. Özel küp türleri etkilenmeyecek.',
						title: 'Ayarları sıfırla',
						buttonText: 'Ayarları sıfırla',
						triggerAction: resetSettings,
					}}
				/>
			</SettingRow>
		</>
	);
}
