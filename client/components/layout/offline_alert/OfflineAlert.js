import React from 'react';
import './OfflineAlert.scss';
import {Offline} from 'react-detect-offline';

export default class OfflineAlert extends React.Component {
	render() {
		if (typeof window !== 'undefined' && window.location.href.indexOf('localhost') > -1) {
			return null;
		}

		return (
			<Offline>
				<div className="cd-offline">
					<p>Şu anda çevrimdışısınız. Zkt-timer'ı kullanmaya devam edebilirsiniz, ancak hiçbir değişiklik kaydedilmeyecektir..</p>
				</div>
			</Offline>
		);
	}
}
