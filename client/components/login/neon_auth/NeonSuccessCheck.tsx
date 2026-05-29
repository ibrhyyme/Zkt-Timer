import React from 'react';
import block from '../../../styles/bem';
import './neon-auth.scss';

const b = block('neon-check');

interface Props {
	size?: number;
}

/** Neon success check — glowing halo, spinning conic ring, drawn tick. */
export default function NeonSuccessCheck({size = 96}: Props) {
	const s = Math.round(size * 0.52);
	return (
		<div className={b()} style={{width: size, height: size}}>
			<span className={b('halo')} aria-hidden="true" />
			<span className={b('ring')} aria-hidden="true" />
			<svg width={s} height={s} viewBox="0 0 52 52" style={{position: 'relative', zIndex: 2, overflow: 'visible'}}>
				<path
					className={b('path').toString()}
					d="M13 27 L22 36 L39 17"
					fill="none"
					stroke="#ffffff"
					strokeWidth={5}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</div>
	);
}
