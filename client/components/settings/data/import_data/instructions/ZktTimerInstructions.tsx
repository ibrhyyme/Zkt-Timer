import React from 'react';
import { useTranslation } from 'react-i18next';
import block from '../../../../../styles/bem';
import ImportSection from '../import_section/ImportSection';

const b = block('import-instructions');

export default function ZktTimerInstructions() {
	const { t } = useTranslation();

	return (
		<div className={b()}>
			<ImportSection title={t('data_settings.zkttimer_instructions_title')}>
				<ol>
					<li>
						<a href="/settings" target="_blank">
							{t('data_settings.zkttimer_step_1_link')}
						</a>{' '}
						{t('data_settings.zkttimer_step_1_suffix')}
					</li>
					<li>{t('data_settings.zkttimer_step_2')}</li>
				</ol>
			</ImportSection>
		</div>
	);
}
