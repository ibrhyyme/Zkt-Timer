import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import block from '../../../../../styles/bem';
import { ImportDataContext } from '../ImportData';
import { ButtonProps } from '../../../../common/button/Button';
import ImportSection from '../import_section/ImportSection';

const b = block('import-instructions');

export default function CsTimerInstructions() {
	const { t } = useTranslation();
	const context = useContext(ImportDataContext);

	const dropdownButtonProps: ButtonProps = {
		glow: true,
		primary: true,
		large: true,
		disabled: context.importing || !!context.file,
	};

	if (!context.cubeType) {
		dropdownButtonProps.text = t('data_settings.select_cube_type');
	}

	return (
		<div className={b()}>
			<ImportSection title={t('data_settings.cstimer_instructions_title')}>
				<ol>
					<li>
						<a href="https://cstimer.net" target="_blank">
							cstimer.net
						</a>{' '}
						{t('data_settings.cstimer_step_1_suffix')}
					</li>
					<li>{t('data_settings.cstimer_step_2')}</li>
					<li>{t('data_settings.cstimer_step_3')}</li>
				</ol>
			</ImportSection>
		</div>
	);
}
