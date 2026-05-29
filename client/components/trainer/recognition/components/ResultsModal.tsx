/**
 * ResultsModal — mobil fullscreen results overlay.
 * Esc tusu ile kapanir, body overflow hidden olur.
 */
import React, {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import Button, {CommonType} from '../../../common/button/Button';
import ResultsList from './ResultsList';
import {useKeydown} from '../hooks/useKeydown';
import type {ResultRecord} from '../../../../util/trainer/recognition/evaluation';

const b = block('trainer-recognition');

interface ResultsModalProps {
	results: ResultRecord[];
	totalCases: number;
	onClose: () => void;
}

export default function ResultsModal({results, totalCases, onClose}: ResultsModalProps) {
	const {t} = useTranslation();

	useKeydown((e) => {
		if (e.key === 'Escape' && !document.querySelector('.modal.show')) {
			onClose();
			e.preventDefault();
			e.stopPropagation();
		}
	});

	useEffect(() => {
		document.body.classList.add('overflow-hidden');
		return () => {
			document.body.classList.remove('overflow-hidden');
		};
	}, []);

	return (
		<div className={b('results-modal')}>
			<div style={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
				<div style={{fontSize: '1.3rem', fontWeight: 700}}>
					{t('trainer.recognition.trainer_results_title', {defaultValue: 'Results'})} ({results.length}/{totalCases})
				</div>
				<hr style={{border: 'none', borderTop: '1px solid rgba(var(--text-color), 0.08)', margin: '0.5rem 0'}} />
				<div style={{flex: 1, overflowY: 'auto'}}>
					<ResultsList results={results} pictureSize={70} showNotes={false} />
				</div>
				<div
					style={{
						padding: '0.75rem 0 0',
						borderTop: '1px solid rgba(var(--text-color), 0.08)',
						textAlign: 'right',
					}}
				>
					<Button
						theme={CommonType.PRIMARY}
						text={t('trainer.recognition.results_modal_close', {defaultValue: 'Close (Esc)'})}
						onClick={onClose}
					/>
				</div>
			</div>
		</div>
	);
}
