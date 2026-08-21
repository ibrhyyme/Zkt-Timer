import React from 'react';
import './Logo.scss';

interface LogoProps {
	large?: boolean;
	dark?: boolean;
}

export default function Logo({ large }: LogoProps) {
	return (
		<span className={`zt-logo${large ? ' zt-logo--large' : ''}`} aria-label="Zkt Timer">
			<img className="zt-logo__img zt-logo__img--dark" src="/public/images/zkt-logo.png" alt="" />
			<img className="zt-logo__img zt-logo__img--light" src="/public/images/zkt-logo-white.png" alt="" />
		</span>
	);
}
