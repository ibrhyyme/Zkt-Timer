import React from 'react';
import { useTranslation } from 'react-i18next';
import block from '../../../../../styles/bem';
import ImportSection from '../import_section/ImportSection';

const b = block('import-instructions');

export default function LastCubeXInstructions() {
	const { t } = useTranslation();

	return (
		<div className={b()}>
			<ImportSection title={t('data_settings.lastcubex_instructions_title')}>
				<ol>
					<li>{t('data_settings.lastcubex_step_1')}</li>
					<li>{t('data_settings.lastcubex_step_2')}</li>
					<li>{t('data_settings.lastcubex_step_3')}</li>
				</ol>
			</ImportSection>
		</div>
	);
}
