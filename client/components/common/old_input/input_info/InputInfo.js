import React from 'react';

export default class InputInfo extends React.Component {
    render() {
        if (!this.props.children) {
            return null;
        }
        return <span className="zt-common__input-info">{this.props.children}</span>;
    }
}
