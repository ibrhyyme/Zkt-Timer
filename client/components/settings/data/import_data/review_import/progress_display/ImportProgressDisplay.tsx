import React from 'react';
import './ImportProgressDisplay.scss';
import { ImportProgress } from '../chunked_import';

interface Props {
	progress: ImportProgress;
}

export default function ImportProgressDisplay({ progress }: Props) {
	const { percentComplete } = progress;

	return (
		<div className="import-progress">
			<div className="import-progress__bar-container">
				<div
					className="import-progress__bar"
					style={{ width: `${percentComplete}%` }}
				/>
			</div>
		</div>
	);
}
