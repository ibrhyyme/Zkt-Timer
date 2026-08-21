import React from 'react';
import {CircleNotch} from 'phosphor-react';
import './Loading.scss';

export default function Loading() {
	return (
		<div className="zt-common__loading">
			<CircleNotch className="spin" weight="bold" />
		</div>
	);
}
