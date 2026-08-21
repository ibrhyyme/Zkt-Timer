import React from 'react';
import './Error.scss';

export default class Error extends React.Component {
	render() {
		const {text} = this.props;

		return <div className="zt-common__error">{text}</div>;
	}
}
