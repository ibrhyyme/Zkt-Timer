import React from 'react';
import block from '../../../../../styles/bem';
import ImportSection from '../import_section/ImportSection';

const b = block('import-instructions');

export default function ZktTimerInstructions() {
	return (
		<div className={b()}>
			<ImportSection title="Zkt-Timer'dan veriler nasıl dışa aktarılır">
				<ol>
					<li>
						<a href="/settings" target="_blank">
							Ayarlar
						</a>{' '}
						sayfasına gidin
					</li>
					<li>"Verileri dışa aktar" butonuna tıklayın ve dosyayı kaydedin</li>
				</ol>
			</ImportSection>
		</div>
	);
}
