import React, {useState} from 'react';
import {gql} from '@apollo/client/core';
import {validateStrongPassword} from '../../../util/auth/password';
import PasswordStrength from '../../common/password_strength/PasswordStrength';
import Input from '../../common/inputs/input/Input';
import Button from '../../common/button/Button';
import {useInput} from '../../../util/hooks/useInput';
import {useMutation} from '@apollo/client';
import {UserAccount} from '../../../@types/generated/graphql';
import {toastSuccess} from '../../../util/toast';

const UPDATE_PASSWORD_MUTATION = gql`
	mutation Mutate($oldPassword: String!, $newPassword: String!) {
		updateUserPassword(old_password: $oldPassword, new_password: $newPassword) {
			id
		}
	}
`;

export default function Password() {
	const [oldPassword, setOldPassword] = useInput('');
	const [password, setPassword] = useInput('');
	const [error, setError] = useState('');

	const [updatePassword, updatePasswordData] = useMutation<
		{updateUserPassword: UserAccount},
		{
			oldPassword: string;
			newPassword: string;
		}
	>(UPDATE_PASSWORD_MUTATION);

	async function changePassword() {
		if (updatePasswordData?.loading) {
			return;
		}

		const validate = validateStrongPassword(password);
		if (!validate.number1Check || !validate.cap1Check || !validate.char8Check) {
			setError('Zayıf şifre');
			return;
		}

		try {
			await updatePassword({
				variables: {
					oldPassword,
					newPassword: password,
				},
			});

			toastSuccess('Şifre başarıyla güncellendi');
		} catch (err) {
			setError(err.message);
		}
	}

	return (
		<div>
			<Input type="password" value={oldPassword} legend="Mevcut Şifre" onChange={setOldPassword} />
			<Input type="password" value={password} legend="Yeni Şifre" onChange={setPassword} />
			<PasswordStrength password={password} />
			<Button
				primary
				glow
				large
				text="Şifre Değiştir"
				error={error}
				loading={updatePasswordData?.loading}
				onClick={changePassword}
			/>
		</div>
	);
}
