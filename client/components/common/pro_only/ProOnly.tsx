import React, {ReactNode} from 'react';
import {isProEnabled, isPro} from '../../../lib/pro';
import {useMe} from '../../../util/hooks/useMe';

interface Props {
	forceShow?: boolean;
	ignore?: boolean;
	noPadding?: boolean;
	children: ReactNode;
	lockIconOnly?: boolean;
}

export default function ProOnly(props: Props) {
	const {children, ignore, forceShow} = props;
	const me = useMe();

	// When Pro is disabled globally or explicitly ignored, show content to everyone
	if (!isProEnabled() || ignore) {
		return <>{children}</>;
	}

	// Force show overrides Pro check
	if (forceShow) {
		return <>{children}</>;
	}

	// When Pro is enabled, only show to Pro users
	if (isPro(me)) {
		return <>{children}</>;
	}

	return null;
}
