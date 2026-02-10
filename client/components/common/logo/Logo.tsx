import React from 'react';
import './Logo.scss';

interface LogoProps {
	large?: boolean;
	dark?: boolean;
}

export default function Logo(props: LogoProps) {
	return <div className="cd-logo" />;
}
