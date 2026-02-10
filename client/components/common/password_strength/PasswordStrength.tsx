import React from 'react';
import {validateStrongPassword} from '../../../util/auth/password';
import './PasswordStrength.scss';
import {Check} from 'phosphor-react';
import block from '../../../styles/bem';

const b = block('password-strength');

interface Props {
	password: string;
	confirmPassword?: string;
}

export default function PasswordStrength(props: Props) {
	const {password, confirmPassword} = props;
	const result = validateStrongPassword(password, confirmPassword);

	let confirm = null;
	if (typeof confirmPassword === 'string') {
		confirm = <PasswordCase name="Şifreler eşleşiyor" checked={result.confirmMatches} />;
	}

	return (
		<div className={b()}>
			<PasswordCase name="Küçük harf" checked={result.lower1Check} />
			<PasswordCase name="Büyük harf" checked={result.cap1Check} />
			<PasswordCase name="1 rakam" checked={result.number1Check} />
			<PasswordCase name="8 karakter" checked={result.char8Check} />
			{confirm}
		</div>
	);
}

interface SingleProps {
	name: string;
	checked: boolean;
}

function PasswordCase(props: SingleProps) {
	const {name, checked} = props;

	return (
		<span className={b('case', {checked})}>
			<Check weight="bold" />
			{name}
		</span>
	);
}
