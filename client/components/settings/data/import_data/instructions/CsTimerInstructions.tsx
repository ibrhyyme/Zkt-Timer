import React, { useContext } from 'react';
import block from '../../../../../styles/bem';
import CubePicker from '../../../../common/cube_picker/CubePicker';
import { ImportDataContext } from '../ImportData';
import { ButtonProps } from '../../../../common/button/Button';
import ImportSection from '../import_section/ImportSection';

const b = block('import-instructions');

export default function CsTimerInstructions() {
	const context = useContext(ImportDataContext);

	const dropdownButtonProps: ButtonProps = {
		glow: true,
		primary: true,
		large: true,
		disabled: context.importing || !!context.file,
	};

	if (!context.cubeType) {
		dropdownButtonProps.text = 'Küp türünü seçin';
	}

	return (
		<div className={b()}>
			<ImportSection title="csTimer'dan veriler nasıl dışa aktarılır">
				<ol>
					<li>
						<a href="https://cstimer.net" target="_blank">
							cstimer.net
						</a>{' '}
						adresine gidin
					</li>
					<li>"Dışa Aktar" simgesine tıklayın (Ayarlar butonunun yanında)</li>
					<li>"Dosyaya aktar"a tıklayın</li>
				</ol>
			</ImportSection>
		</div>
	);
}
