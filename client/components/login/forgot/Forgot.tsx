import React, {useState} from 'react';
import Input from '../../common/inputs/input/Input';
import {Link} from 'react-router-dom';
import PasswordStrength from '../../common/password_strength/PasswordStrength';
import {validateStrongPassword} from '../../../util/auth/password';
import {gql, useMutation} from '@apollo/client';
import {useInput} from '../../../util/hooks/useInput';
import {getRedirectLink} from '../../../util/auth/login';
import {UserAccount} from '../../../@types/generated/graphql';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';

const b = block('login');

enum ForgotStage {
	EnterEmail,
	EnterCode,
	NewPassword,
}

const SENT_FORGOT_PASSWORD_CODE_MUTATION = gql`
	mutation Mutate($email: String!) {
		sendForgotPasswordCode(email: $email)
	}
`;

const CHECK_FORGOT_PASSWORD_CODE = gql`
	mutation Mutate($email: String!, $code: String!) {
		checkForgotPasswordCode(email: $email, code: $code)
	}
`;

const UPDATE_FORGOT_PASSWORD_MUTATION = gql`
	mutation Mutate($email: String!, $code: String!, $password: String!) {
		updateForgotPassword(email: $email, code: $code, password: $password) {
			id
		}
	}
`;

export default function Forgot() {
	const [stage, setStage] = useState<ForgotStage>(ForgotStage.EnterEmail);
	const [code, setCode] = useInput('');
	const [email, setEmail] = useInput('');
	const [newPassword, setNewPassword] = useInput('');
	const [confirmPassword, setConfirmPassword] = useInput('');
	const [error, setError] = useState('');

	const [forgotCode, forgotCodeData] = useMutation<{sendForgotPasswordCode: void}, {email: string}>(
		SENT_FORGOT_PASSWORD_CODE_MUTATION
	);
	const [checkForgot, checkForgotData] = useMutation<
		{sendForgotPasswordCode: void},
		{
			email: string;
			code: string;
		}
	>(CHECK_FORGOT_PASSWORD_CODE);
	const [updatePass, updatePassData] = useMutation<
		{updateForgotPassword: UserAccount},
		{
			email: string;
			code: string;
			password: string;
		}
	>(UPDATE_FORGOT_PASSWORD_MUTATION);

	const loading = forgotCodeData?.loading || checkForgotData?.loading || updatePassData?.loading;
	const err =
		forgotCodeData?.error?.message || checkForgotData?.error?.message || updatePassData?.error?.message || error;

	async function nextStage(e) {
		e.preventDefault();

		if (loading) {
			return;
		}

		switch (stage) {
			case ForgotStage.EnterEmail: {
				if (!email.trim()) {
					setError('Lütfen e-posta adresinizi girin');
					return;
				}

				await forgotCode({variables: {email: email.trim()}});
				setStage(ForgotStage.EnterCode);
				break;
			}
			case ForgotStage.EnterCode: {
				if (!code) {
					setError('Lütfen kodu girin');
					return;
				}

				await checkForgot({variables: {email: email.trim(), code}});
				setStage(ForgotStage.NewPassword);
				break;
			}
			case ForgotStage.NewPassword: {
				const validate = validateStrongPassword(newPassword, confirmPassword);

				if (!validate.isStrong) {
					setError(validate.errorMessage);
					return;
				}

				await updatePass({variables: {email: email.trim(), code, password: newPassword}});
				window.location.href = getRedirectLink();
				return;
			}
		}
	}

	let body = null;
	switch (stage) {
		case 0: {
			body = (
				<div className={b('section')}>
					<Input onChange={setEmail} value={email} name="email" legend="E-posta" />
					<Button loading={loading} type="submit" error={error} large primary text="Kod Al" />
				</div>
			);
			break;
		}
		case 1: {
			body = (
				<div className={b('section')}>
					<p>Lütfen e-postanızı kontrol edin. Şifrenizi sıfırlamak için bir kod almış olmalısınız.</p>
					<Input onChange={setCode} value={code} name="code" legend="Kod" />
					<Button loading={loading} type="submit" error={error} large primary text="Kodu Kontrol Et" />
				</div>
			);
			break;
		}
		case 2: {
			body = (
				<div className={b('section')}>
					<p>Lütfen yeni şifrenizi belirleyin.</p>
					<Input
						type="password"
						value={newPassword}
						legend="Yeni Şifre"
						name="newPassword"
						onChange={setNewPassword}
					/>
					<Input
						type="password"
						value={confirmPassword}
						legend="Şifre Tekrarı"
						name="confirmPassword"
						onChange={setConfirmPassword}
					/>
					<PasswordStrength confirmPassword={confirmPassword} password={newPassword} />
					<Button loading={loading} type="submit" error={err} large primary text="Şifreyi Değiştir ve Giriş Yap" />
				</div>
			);
			break;
		}
	}

	return (
		<div className={b()}>
			<form onSubmit={nextStage}>{body}</form>
			<p>
				Ayrıca <Link to="/signup">kayıt olabilir</Link> veya <Link to="/login">giriş yapabilirsiniz</Link>.
			</p>
		</div>
	);
}
