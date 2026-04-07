import React, {ReactElement} from 'react';
import './Community.scss';
import CommunityNav from './nav/CommunityNav';
import block from '../../styles/bem';

const b = block('community');

interface Props {
	children: ReactElement;
}

export default function Community({children}: Props) {
	return (
		<div className={b()}>
			<CommunityNav />
			{children}
		</div>
	);
}
