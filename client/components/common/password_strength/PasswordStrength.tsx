import React from 'react';
import {validateStrongPassword} from '../../../util/auth/password';
import './PasswordStrength.scss';
import {Check} from 'phosphor-react';
import block from '../../../styles/bem';
import {useTranslation} from 'react-i18next';

const b = block('password-strength');

interface Props {
	password: string;
	confirmPassword?: string;
}

export default function PasswordStrength(props: Props) {
	const {password, confirmPassword} = props;
	const {t} = useTranslation();
	const result = validateStrongPassword(password, confirmPassword);

	let confirm = null;
	if (typeof confirmPassword === 'string') {
		confirm = <PasswordCase name={t('password_strength.passwords_match')} checked={result.confirmMatches} />;
	}

	return (
		<div className={b()}>
			<PasswordCase name={t('password_strength.lowercase')} checked={result.lower1Check} />
			<PasswordCase name={t('password_strength.uppercase')} checked={result.cap1Check} />
			<PasswordCase name={t('password_strength.one_number')} checked={result.number1Check} />
			<PasswordCase name={t('password_strength.eight_chars')} checked={result.char8Check} />
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
