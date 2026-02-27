import React, {useCallback, useRef} from 'react';
import block from '../../../styles/bem';
import {exportAlgorithms, importAlgorithms} from '../hooks/useAlgorithmData';
import {useTranslation} from 'react-i18next';
import {X, Export, DownloadSimple} from 'phosphor-react';

const b = block('trainer');

interface TrainerOptionsProps {
	onClose: () => void;
}

export default function TrainerOptions({onClose}: TrainerOptionsProps) {
	const {t} = useTranslation();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleExport = useCallback(() => {
		exportAlgorithms();
	}, []);

	const handleImportClick = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		await importAlgorithms(file);
		if (fileInputRef.current) {
			fileInputRef.current.value = '';
		}
	}, []);

	return (
		<div className={b('options-overlay')} onClick={onClose}>
			<div className={b('options-modal')} onClick={(e) => e.stopPropagation()}>
				<div className={b('options-header')}>
					<h3>{t('trainer.options')}</h3>
					<button className={b('options-close')} onClick={onClose}>
						<X size={20} />
					</button>
				</div>

				<div className={b('options-body')}>
					<div className={b('options-section')}>
						<h4 className={b('options-section-title')}>{t('trainer.algorithm_management')}</h4>
						<p className={b('options-section-desc')}>
							{t('trainer.export_desc')}
						</p>
						<button className={b('options-action-btn')} onClick={handleExport}>
							<Export size={16} />
							{t('trainer.export')}
						</button>
						<p className={b('options-section-desc')}>
							{t('trainer.import_desc')}
						</p>
						<button className={b('options-action-btn')} onClick={handleImportClick}>
							<DownloadSimple size={16} />
							{t('trainer.import')}
						</button>
						<input
							ref={fileInputRef}
							type="file"
							accept=".json"
							style={{display: 'none'}}
							onChange={handleImportFile}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
