import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import ImportData, { ImportDataType } from './import_data/ImportData';
import fileDownload from 'js-file-download';
import { gql } from '@apollo/client/core';
import { gqlMutate, removeTypename } from '../../api';
import { openModal } from '../../../actions/general';
import { fetchSessions } from '../../../db/sessions/query';
import { fetchSolves } from '../../../db/solves/query';
import { toastError, toastSuccess } from '../../../util/toast';
import { clearOfflineData } from '../../layout/offline';
import LoggedInOnly from '../../common/logged_in_only/LoggedInOnly';
import { useMe } from '../../../util/hooks/useMe';
import { isPro, isProEnabled } from '../../../lib/pro';
import { useHistory } from 'react-router-dom';
import { setGeneral } from '../../../actions/general';
import ConfirmModal from '../../common/confirm_modal/ConfirmModal';
import {
	TimerSettingsGroup,
	TimerSettingsAction,
	TimerSettingsSelect,
} from '../timer/TimerSettingsRow';

export default function DataSettings() {
	const { t } = useTranslation();
	const dispatch = useDispatch();
	const me = useMe();
	const history = useHistory();
	const showProOverlay = isProEnabled() && !isPro(me);

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

	function confirmResetSettings() {
		dispatch(
			openModal(
				<ConfirmModal
					title={t('data_settings.reset_settings')}
					description={t('data_settings.reset_settings_confirm_desc')}
					buttonText={t('data_settings.reset_settings_button')}
					triggerAction={resetSettings}
				/>
			)
		);
	}

	return (
		<LoggedInOnly>
			<div className="space-y-2">
				{/* Veri Yönetimi */}
				<TimerSettingsGroup id="data-management" label={t('data_settings.category_management')}>
					<TimerSettingsAction
						label={t('data_settings.force_reload')}
						description={t('data_settings.force_reload_desc')}
					>
						<button
							type="button"
							onClick={hardReload}
							className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#2a2a2e] border border-white/[0.1] text-slate-300 hover:bg-[#3a3a3e] hover:text-white hover:border-white/[0.15] transition-all duration-200 cursor-pointer"
						>
							{t('data_settings.force_reload_button')}
						</button>
					</TimerSettingsAction>
					<TimerSettingsAction
						label={t('data_settings.export_data')}
						description={t('data_settings.export_data_desc')}
					>
						<button
							type="button"
							onClick={exportData}
							disabled={exportingData}
							className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${exportingData
								? 'bg-[#2a2a2e] border-white/[0.05] text-[#555] cursor-not-allowed'
								: 'bg-[#2a2a2e] border-white/[0.1] text-slate-300 hover:bg-[#3a3a3e] hover:text-white hover:border-white/[0.15] cursor-pointer'
								}`}
						>
							{exportingData ? '...' : t('data_settings.export_button')}
						</button>
					</TimerSettingsAction>
					{showProOverlay ? (
						<div style={{position: 'relative'}}>
							<div style={{filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none'}}>
								<TimerSettingsSelect
									label={t('data_settings.import_data')}
									description={t('data_settings.import_data_desc')}
									value=""
									options={[
										{ label: t('data_settings.import_cstimer'), value: 'cstimer' },
										{ label: t('data_settings.import_zkttimer'), value: 'zkttimer' },
										{ label: t('data_settings.import_twistytimer'), value: 'twistytimer' },
									]}
									onChange={() => {}}
								/>
							</div>
							<div
								onClick={() => { dispatch(setGeneral('settings_modal_open', false)); history.push('/account/pro'); }}
								style={{
									position: 'absolute',
									top: 0, left: 0, right: 0, bottom: 0,
									display: 'flex',
									flexDirection: 'column',
									alignItems: 'center',
									justifyContent: 'center',
									gap: '6px',
									cursor: 'pointer',
									borderRadius: '8px',
									background: 'rgba(0,0,0,0.4)',
									backdropFilter: 'blur(4px)',
									zIndex: 1,
									transition: 'background 0.2s ease',
								}}
							>
								<span style={{color: '#a78bfa', fontSize: '1.2rem'}}>&#9733;</span>
								<span style={{color: '#fff', fontWeight: 600, fontSize: '0.85rem'}}>
									{t('data_settings.import_pro_upsell')}
								</span>
							</div>
						</div>
					) : (
						<TimerSettingsSelect
							label={t('data_settings.import_data')}
							description={t('data_settings.import_data_desc')}
							value=""
							options={[
								{ label: t('data_settings.import_cstimer'), value: 'cstimer' },
								{ label: t('data_settings.import_zkttimer'), value: 'zkttimer' },
								{ label: t('data_settings.import_twistytimer'), value: 'twistytimer' },
							]}
							onChange={(v) => {
								const typeMap: Record<string, ImportDataType> = {
									cstimer: ImportDataType.CS_TIMER,
									zkttimer: ImportDataType.ZKT_TIMER,
									twistytimer: ImportDataType.TWISTY_TIMER,
								};
								if (typeMap[v]) openImportModal(typeMap[v]);
							}}
						/>
					)}
				</TimerSettingsGroup>

				{/* Sıfırlama */}
				<TimerSettingsGroup id="data-reset" label={t('data_settings.category_reset')}>
					<TimerSettingsAction
						label={t('data_settings.reset_settings')}
						description={t('data_settings.reset_settings_desc')}
					>
						<button
							type="button"
							onClick={confirmResetSettings}
							className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 hover:text-red-300 hover:border-red-500/50 transition-all duration-200 cursor-pointer"
						>
							{t('data_settings.reset_settings_button')}
						</button>
					</TimerSettingsAction>
				</TimerSettingsGroup>
			</div>
		</LoggedInOnly>
	);
}
