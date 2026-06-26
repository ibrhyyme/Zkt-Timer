import React from 'react';
import './Battery.scss';
import block from '../../../../styles/bem';

const b = block('smart-battery');

interface Props {
	level: number;
}

export default function Battery(props: Props) {
	const {level} = props;

	if (typeof level !== 'number') {
		return null;
	}

	return (
		<div
			className={b({
				orange: level < 20 && level > 10,
				red: level <= 10,
			})}
		>
			{level}%
		</div>
	);
}
