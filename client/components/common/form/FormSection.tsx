import React, {ReactNode} from 'react';
import ProOnly from '../pro_only/ProOnly';
import {useMe} from '../../../util/hooks/useMe';
import Tag from '../tag/Tag';
import {isNotPro} from '../../../util/pro';

interface Props {
	removeBorderBottom?: boolean;
	removePaddingTop?: boolean;
	removePaddingBottom?: boolean;
	proOnly?: boolean;
	children?: ReactNode;
}

export default function FormSection(props: Props) {
	const {proOnly, removePaddingBottom, removePaddingTop, removeBorderBottom} = props;

	const me = useMe();
	const classes = ['relative', 'border-solid', 'border-button'];
	if (!removePaddingTop) {
		classes.push('pt-7');
	}
	if (!removePaddingBottom) {
		classes.push('pb-7');
	}

	if (!removeBorderBottom) {
		classes.push('border-b-4');
	}

	let proTag = null;
	let body = props.children;

	if (proOnly && isNotPro(me)) {
		proTag = <Tag text="PRO" textColor="orange" />;
		body = <div className="opacity-40 pointer-events-none select-none">{props.children}</div>;
	}

	return (
		<div className={classes.join(' ')}>
			{proTag}
			{body}
		</div>
	);
}
