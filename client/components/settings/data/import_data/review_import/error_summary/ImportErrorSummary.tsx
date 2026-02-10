import React from 'react';
import './ImportErrorSummary.scss';
import { ChunkedImportResult } from '../chunked_import';
import Button from '../../../../../common/button/Button';

interface Props {
	results: ChunkedImportResult;
	onRetry: () => void;
}

export default function ImportErrorSummary({ results, onRetry }: Props) {
	return (
		<div className="import-error-summary">
			<div className="import-error-summary__header">
				<h3>İçe Aktarma Tamamlandı (Bazı Hatalarla)</h3>
				<p>
					Başarılı: {results.successCount} chunk |
					Başarısız: {results.failureCount} chunk
				</p>
			</div>

			<div className="import-error-summary__errors">
				<h4>Başarısız Chunk'lar:</h4>
				{results.errors.map((error, idx) => (
					<div key={idx} className="import-error-summary__error-item">
						<span className="error-label">Chunk #{error.chunkIndex + 1}</span>
						<span className="error-range">Öğeler: {error.itemRange}</span>
						<span className="error-message">{error.error}</span>
					</div>
				))}
			</div>

			<div className="import-error-summary__actions">
				<Button
					text="Başarısız Chunk'ları Tekrar Dene"
					onClick={onRetry}
					primary
				/>
				<Button
					text="Yine de Devam Et"
					onClick={() => window.location.href = '/sessions'}
				/>
			</div>
		</div>
	);
}
