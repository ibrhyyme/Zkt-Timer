import React, { useEffect } from 'react';
import './LoadingCover.scss';
import block from '../../../styles/bem';
import { getLocalStorage } from '../../../util/data/local_storage';
import CSS from 'csstype';
import LoadingIcon from '../../common/LoadingIcon';
import { Capacitor } from '@capacitor/core';

const b = block('loading-cover');

// Capacitor native'de LoadingCover gösterme (native splash screen zaten gösteriyor)
const isCapacitorNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

interface Props {
	fadeOut?: boolean;
}

export default function LoadingCover(props: Props) {
	const { fadeOut } = props;

	const [style, setStyle] = React.useState<CSS.Properties>({});

	useEffect(() => {
		if (isCapacitorNative || fadeOut || typeof localStorage === 'undefined') return;

		const backgroundColor = getLocalStorage('background_color');
		const textColor = getLocalStorage('text_color');

		if (backgroundColor && backgroundColor.includes(',')) {
			style.backgroundColor = `rgb(${backgroundColor})`;
		}
		if (textColor && textColor.includes(',')) {
			style.color = `rgb(${textColor})`;
		}

		setStyle(style);
	}, [typeof localStorage]);

	if (isCapacitorNative) {
		return null;
	}

	return (
		<div
			style={style}
			className={b({
				fadeOut,
			})}
		>
			<img
				src="/public/images/zkt-logo.png"
				alt="ZKT-Timer"
				className="w-32 animate-pulse"
			/>
		</div>
	);
}
