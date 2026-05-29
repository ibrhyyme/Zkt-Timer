import React, {ReactNode} from 'react';
import './StatSection.scss';
import block from '../../../../styles/bem';
import CSS from 'csstype';
import ProOnly from '../../../common/pro_only/ProOnly';

const b = block('stat-section');

interface Props {
	title: string;
	className?: string;
	minWidth?: string;
	description?: string;
	proOnly?: boolean;
	children: ReactNode;
	rowSpan?: number | string;
	colSpan?: number | string;
	headerAction?: ReactNode;
}

export default function StatSection(props: Props) {
	const {title, minWidth, proOnly, description, children, className, rowSpan, colSpan, headerAction} = props;

	let desc = null;
	if (description) {
		desc = <p>{description}</p>;
	}

	const style: CSS.Properties = {};
	if (rowSpan) {
		style.gridRow = `span ${rowSpan}`;
	}
	if (colSpan) {
		style.gridColumn = `span ${colSpan}`;
	}
	if (minWidth) {
		style.minWidth = minWidth;
	}

	return (
		<div className={b.mix(className)} style={style}>
			<div className={b('header')}>
				<div className={b('header-main')}>
					<h2>{title}</h2>
					{desc}
				</div>
				{headerAction ? <div className={b('header-action')}>{headerAction}</div> : null}
			</div>
			{children}
		</div>
	);
}
