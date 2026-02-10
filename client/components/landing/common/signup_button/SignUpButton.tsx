import React from 'react';
import './SignUpButton.scss';
import { ArrowRight } from 'phosphor-react';
import block from '../../../../styles/bem';

const b = block('landing-signup-button');

export default function SignUpButton() {
	return (
		<div className={b('wrapper')}>
			<a href="/" className={b()}>
				<span>Demo Dene</span>
				<ArrowRight />
			</a>
		</div>
	);
}
