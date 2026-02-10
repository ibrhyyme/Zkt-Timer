import React from 'react';
import './ImportProgressDisplay.scss';
import { ImportProgress } from '../chunked_import';

interface Props {
	progress: ImportProgress;
}

export default function ImportProgressDisplay({ progress }: Props) {
	const { type, currentChunk, totalChunks, itemsProcessed, totalItems, percentComplete } = progress;

	const typeText = type === 'sessions' ? 'Sezonlar' : 'Çözümler';

	return (
		<div className="import-progress">
			<div className="import-progress__bar-container">
				<div
					className="import-progress__bar"
					style={{ width: `${percentComplete}%` }}
				/>
			</div>
			<div className="import-progress__text">
				{typeText} içe aktarılıyor: Chunk {currentChunk}/{totalChunks} ({itemsProcessed}/{totalItems})
			</div>
			<div className="import-progress__percentage">
				%{percentComplete} tamamlandı
			</div>
		</div>
	);
}
