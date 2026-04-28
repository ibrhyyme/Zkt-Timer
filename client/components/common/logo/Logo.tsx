import React from 'react';
import './Logo.scss';

interface LogoProps {
	large?: boolean;
	dark?: boolean;
}

export default function Logo({ large }: LogoProps) {
	return (
		<span className={`cd-logo${large ? ' cd-logo--large' : ''}`} aria-label="Zkt Timer">
			<img className="cd-logo__img cd-logo__img--dark" src="/public/images/zkt-logo.png" alt="" />
			<img className="cd-logo__img cd-logo__img--light" src="/public/images/zkt-logo-white.png" alt="" />
		</span>
	);
}
