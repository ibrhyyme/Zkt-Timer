import React, { useEffect } from 'react';
import './LoadingCover.scss';
import block from '../../../styles/bem';
import { getLocalStorage } from '../../../util/data/local_storage';
import CSS from 'csstype';
import LoadingIcon from '../../common/LoadingIcon';

const b = block('loading-cover');

interface Props {
	fadeOut?: boolean;
}

export default function LoadingCover(props: Props) {
	const { fadeOut } = props;

	const [style, setStyle] = React.useState<CSS.Properties>({});

	useEffect(() => {
		if (fadeOut || typeof localStorage === 'undefined') return;

		const backgroundColor = getLocalStorage('background_color');
		const textColor = getLocalStorage('text_color');

		const newStyle: CSS.Properties = {};
		if (backgroundColor && backgroundColor.includes(',')) {
			newStyle.backgroundColor = `rgb(${backgroundColor})`;
		}
		if (textColor && textColor.includes(',')) {
			newStyle.color = `rgb(${textColor})`;
		}

		setStyle(newStyle);
	}, [typeof localStorage]);

	return (
		<div
			style={style}
			className={b({
				fadeOut,
			})}
		>
			<span className="cd-logo spin" aria-label="Zkt Timer" style={{ width: '8rem', height: '8rem' }}>
				<img className="cd-logo__img cd-logo__img--dark" src="/public/images/zkt-logo.png" alt="" />
				<img className="cd-logo__img cd-logo__img--light" src="/public/images/zkt-logo-white.png" alt="" />
			</span>
		</div>
	);
}
