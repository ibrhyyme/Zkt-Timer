import React from 'react';
import {b} from './shared';

interface Props {
	title: string;
	children: React.ReactNode;
}

export default function SubSection({title, children}: Props) {
	return (
		<div className={b('sub-section')}>
			<div className={b('sub-section-title')}>{title}</div>
			{children}
		</div>
	);
}
