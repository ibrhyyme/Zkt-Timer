import React from 'react';
import './OfflineAlert.scss';
import { Offline } from 'react-detect-offline';

export default class OfflineAlert extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			show: false
		};
	}

	componentDidMount() {
		// Delay showing the alert to prevent false positives during initial load
		this.timeout = setTimeout(() => {
			this.setState({ show: true });
		}, 2000);
	}

	componentWillUnmount() {
		if (this.timeout) clearTimeout(this.timeout);
	}

	render() {
		if (typeof window !== 'undefined' && window.location.href.indexOf('localhost') > -1) {
			return null;
		}

		if (!this.state.show) {
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
