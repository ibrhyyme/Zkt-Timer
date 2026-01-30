import React from 'react';
import './SolveCheck.scss';
import Button from '../../../common/button/Button';
import { IModalProps } from '../../../common/modal/Modal';
import block from '../../../../styles/bem';
import { resourceUri } from '../../../../util/storage';
import { useWindowListener } from '../../../../util/hooks/useListener';

const b = block('smart-cube-solve-check');

export default function SolveCheck(props: IModalProps) {
	useWindowListener('keydown', (e) => {
		if (e.keyCode === 13) {
			props.onComplete();
		}
	});

	return (
		<div className={b()}>
			<img src={resourceUri('/images/rubiks_cube_solve.svg')} alt="Solved speed cube" />
			<Button text="Küpüm çözülü" primary onClick={props.onComplete} />
		</div>
	);
}
