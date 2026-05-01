import React from 'react';
import { useTranslation } from 'react-i18next';
import block from '../../../../../styles/bem';
import ImportSection from '../import_section/ImportSection';

const b = block('import-instructions');

export default function CubeTimeInstructions() {
	const { t } = useTranslation();

	return (
		<div className={b()}>
			<ImportSection title={t('data_settings.cubetime_instructions_title')}>
				<ol>
					<li>{t('data_settings.cubetime_step_1')}</li>
					<li>{t('data_settings.cubetime_step_2')}</li>
					<li>
						<strong>{t('data_settings.cubetime_step_3_emphasis')}</strong>{' '}
						{t('data_settings.cubetime_step_3_suffix')}
					</li>
					<li>{t('data_settings.cubetime_step_4')}</li>
					<li>{t('data_settings.cubetime_step_5')}</li>
				</ol>
			</ImportSection>
		</div>
	);
}
