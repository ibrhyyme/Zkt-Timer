import React from 'react';
import './ImportErrorSummary.scss';
import { ChunkedImportResult } from '../chunked_import';
import Button from '../../../../../common/button/Button';
import { useTranslation } from 'react-i18next';

interface Props {
	results: ChunkedImportResult;
	onRetry: () => void;
}

export default function ImportErrorSummary({ results, onRetry }: Props) {
	const { t } = useTranslation();

	return (
		<div className="import-error-summary">
			<div className="import-error-summary__header">
				<h3>{t('data_settings.import_error_title')}</h3>
				<p>
					{t('data_settings.import_success_count', { count: results.successCount })} |{' '}
					{t('data_settings.import_failed_count', { count: results.failureCount })}
				</p>
			</div>

			<div className="import-error-summary__errors">
				<h4>{t('data_settings.import_failed_chunks_header')}</h4>
				{results.errors.map((error, idx) => (
					<div key={idx} className="import-error-summary__error-item">
						<span className="error-label">Chunk #{error.chunkIndex + 1}</span>
						<span className="error-range">{t('data_settings.import_items_range', { range: error.itemRange })}</span>
						<span className="error-message">{error.error}</span>
					</div>
				))}
			</div>

			<div className="import-error-summary__actions">
				<Button
					text={t('data_settings.import_retry_failed_btn')}
					onClick={onRetry}
					primary
				/>
				<Button
					text={t('data_settings.import_continue_anyway')}
					onClick={() => window.location.href = '/sessions'}
				/>
			</div>
		</div>
	);
}
