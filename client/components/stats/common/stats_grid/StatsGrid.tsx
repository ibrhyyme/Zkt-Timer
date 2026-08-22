import React, {ReactNode} from 'react';
import './StatsGrid.scss';
import block from '../../../../styles/bem';
import CSS from 'csstype';

const b = block('stats-grid');

interface Props {
	rows: number;
	columns: number;
	children: ReactNode;
	style?: CSS.Properties;
	className?: string;
}

export default function StatsGrid(props: Props) {
	const {children, rows, columns} = props;

	return (
		<div
			className={b({}).mix(props.className || '')}
			style={{
				gridTemplateColumns: `repeat(${columns}, 1fr)`,
				// `1fr` rows stretched every block to an equal share of the container
				// height, which is why a one-line stat sat in a 139px tall row once the
				// card padding stopped filling it. Rows size to their content now.
				gridTemplateRows: `repeat(${rows}, auto)`,
				...props.style,
			}}
		>
			{children}
		</div>
	);
}
