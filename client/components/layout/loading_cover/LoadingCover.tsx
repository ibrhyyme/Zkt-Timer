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
			<img
				src="/public/images/zkt-logo.png"
				alt="Zkt Timer"
				className="spin"
				style={{ width: '8rem' }}
			/>
		</div>
	);
}
