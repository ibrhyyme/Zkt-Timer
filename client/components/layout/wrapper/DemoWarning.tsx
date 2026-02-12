import React from 'react';
import { useMe } from '../../../util/hooks/useMe';
import { useGeneral } from '../../../util/hooks/useGeneral';

export default function DemoWarning() {
	const me = useMe();
	const mobileMode = useGeneral('mobile_mode');

	if (me) {
		return null;
	}

	const classNames = [
		'absolute text-sm min-w-fit font-label text-white left-1/2 z-50 -translate-x-1/2 bg-orange-600 rounded py-1 px-2',
	];
	if (mobileMode) {
		classNames.push('top-16');
	} else {
		classNames.push('top-5');
	}

	return (
		<div className={classNames.join(' ')} data-nosnippet="true">
			<span>
				Demo Modu. Veriler kaydedilmiyor.
				<a className="ml-1 underline hover:opacity-100 opacity-75" href="/signup">
					Kayıt Ol
				</a>
			</span>
		</div>
	);
}
