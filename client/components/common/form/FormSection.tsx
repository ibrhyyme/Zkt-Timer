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

	// Pro features are now available to everyone
	let proTag = null;
	let body = props.children;

	return (
		<div className={classes.join(' ')}>
			{proTag}
			{body}
		</div>
	);
}
