import React, {ReactNode} from 'react';
import {isProEnabled} from '../../../lib/pro';

interface Props {
	forceShow?: boolean;
	ignore?: boolean;
	noPadding?: boolean;
	children: ReactNode;
	lockIconOnly?: boolean;
}

export default function ProOnly(props: Props) {
	const {children} = props;
	
	// When Pro is disabled globally, show content to everyone
	if (!isProEnabled()) {
		return <>{children}</>;
	}
	
	// When Pro is enabled, this component would show Pro-gated content
	// For now, since we're soft-disabling, still show to everyone
	return <>{children}</>;
}
