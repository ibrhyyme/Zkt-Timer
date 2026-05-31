import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import Input from '../../common/inputs/input/Input';
import {gql} from '@apollo/client/core';
import {useMe} from '../../../util/hooks/useMe';
import {useInput} from '../../../util/hooks/useInput';
import {useMutation} from '@apollo/client';
import {UserAccount} from '../../../@types/generated/graphql';
import Button from '../../common/button/Button';
import {toastError, toastSuccess} from '../../../util/toast';
import {validateStrongPassword} from '../../../util/auth/password';
import PasswordStrength from '../../common/password_strength/PasswordStrength';
import block from '../../../styles/bem';
import './PersonalInfo.scss';

const b = block('pending-email');

const UPDATE_ME_MUTATION = gql`
	mutation Mutate($firstName: String!, $lastName: String!, $email: String!, $username: String!, $language: String) {
		updateUserAccount(first_name: $firstName, last_name: $lastName, email: $email, username: $username, language: $language) {
			id
		}
	}
`;

const CONFIRM_EMAIL_CHANGE_MUTATION = gql`
	mutation Mutate($code: String!) {
		confirmEmailChange(code: $code) {
			id
		}
	}
`;

const UPDATE_PASSWORD_MUTATION = gql`
	mutation Mutate($oldPassword: String!, $newPassword: String!) {
		updateUserPassword(old_password: $oldPassword, new_password: $newPassword) {
			id
		}
	}
`;

const SET_PASSWORD_MUTATION = gql`
	mutation Mutate($newPassword: String!) {
		setUserPassword(new_password: $newPassword) {
			id
		}
	}
`;

export default function PersonalInfo() {
	const {t, i18n} = useTranslation();
	const me = useMe();

	const [firstName, setFirstName] = useInput(me.first_name);
	const [lastName, setLastName] = useInput(me.last_name);
	const [email, setEmail] = useInput(me.email);
	const [username, setUsername] = useInput(me.username);

	const [oldPassword, setOldPassword] = useInput('');
	const [newPassword, setNewPassword] = useInput('');
	const [passwordError, setPasswordError] = useState('');
	const [emailChangeCode, setEmailChangeCode] = useInput('');
	const [emailChangeError, setEmailChangeError] = useState('');

	const hasPassword = me.has_password;
	const pendingEmail = me.pending_email;

	const [updateAccount] = useMutation<
		{updateUserAccount: UserAccount},
		{firstName: string; lastName: string; email: string; username: string; language: string}
	>(UPDATE_ME_MUTATION);

	const [confirmEmailChange, confirmEmailChangeData] = useMutation<
		{confirmEmailChange: UserAccount},
		{code: string}
	>(CONFIRM_EMAIL_CHANGE_MUTATION);

	const [updatePassword, updatePasswordData] = useMutation<
		{updateUserPassword: UserAccount},
		{oldPassword: string; newPassword: string}
	>(UPDATE_PASSWORD_MUTATION);

	const [setPasswordMut, setPasswordData] = useMutation<
		{setUserPassword: UserAccount},
		{newPassword: string}
	>(SET_PASSWORD_MUTATION);

	async function clickUpdate() {
		try {
			await updateAccount({
				variables: {firstName, lastName, username, email, language: i18n.language},
			});
			const emailChanged = email.toLowerCase() !== me.email.toLowerCase();
			if (emailChanged) {
				toastSuccess(t('personal_info.email_change_pending'));
				setEmailChangeCode('');
				// pending_email cache'de hemen yansiyabilir veya reload ile dusurelim
				window.location.reload();
			} else {
				window.location.reload();
			}
		} catch (err) {
			toastError(err);
		}
	}

	async function clickConfirmEmailChange() {
		setEmailChangeError('');
		if (!emailChangeCode.trim()) {
			setEmailChangeError(t('personal_info.email_change_enter_code'));
			return;
		}
		try {
			await confirmEmailChange({variables: {code: emailChangeCode.trim()}});
			toastSuccess(t('personal_info.email_change_confirmed'));
			window.location.reload();
		} catch (err: any) {
			setEmailChangeError(err.message);
		}
	}

	async function handlePasswordSubmit() {
		setPasswordError('');

		const validate = validateStrongPassword(newPassword);
		if (!validate.number1Check || !validate.cap1Check || !validate.char8Check) {
			setPasswordError(t('password_page.weak_password'));
			return;
		}

		try {
			if (hasPassword) {
				await updatePassword({
					variables: {oldPassword, newPassword},
				});
			} else {
				await setPasswordMut({
					variables: {newPassword},
				});
			}

			toastSuccess(t('personal_info.password_success'));
			setOldPassword('');
			setNewPassword('');
		} catch (err) {
			setPasswordError(err.message);
		}
	}

	const passwordLoading = updatePasswordData?.loading || setPasswordData?.loading;

	return (
		<div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start'}} className="personal-info-grid">
			{/* Sol: Kisisel Bilgiler */}
			<div>
				<Input value={firstName} legend={t('personal_info.first_name')} onChange={setFirstName} name="firstName" />
				<Input value={lastName} legend={t('personal_info.last_name')} onChange={setLastName} name="lastName" />
				<Input value={username} legend={t('personal_info.username')} onChange={setUsername} name="username" />
				<Input value={email} legend={t('personal_info.email')} onChange={setEmail} name="email" />

				{pendingEmail && (
					<div className={b()}>
						<div className={b('title')}>
							<span className={b('icon')}>!</span>
							{t('personal_info.email_change_title')}
						</div>
						<div className={b('description')}>
							{t('personal_info.email_change_description')}
						</div>
						<div className={b('email')}>{pendingEmail}</div>
						<Input
							value={emailChangeCode}
							legend={t('personal_info.email_change_code')}
							onChange={setEmailChangeCode}
							name="emailChangeCode"
						/>
						{emailChangeError && (
							<div className={b('error')}>{emailChangeError}</div>
						)}
						<Button
							primary
							large
							glow
							text={t('personal_info.email_change_confirm_button')}
							loading={confirmEmailChangeData?.loading}
							onClick={clickConfirmEmailChange}
						/>
					</div>
				)}

				<Button primary large glow text={t('personal_info.update_button')} onClick={clickUpdate} />
			</div>

			{/* Sag: Sifre Bolumu */}
			<div>
				<h3 style={{marginBottom: '1rem', fontSize: '1.1rem'}}>
					{hasPassword ? t('personal_info.change_password') : t('personal_info.set_password')}
				</h3>

				{!hasPassword && (
					<p style={{marginBottom: '1rem', fontSize: '0.85rem'}}>
						{t('personal_info.set_password_description')}
					</p>
				)}

				{hasPassword && (
					<Input
						type="password"
						value={oldPassword}
						legend={t('personal_info.current_password')}
						onChange={setOldPassword}
					/>
				)}

				<Input
					type="password"
					value={newPassword}
					legend={t('personal_info.new_password')}
					onChange={setNewPassword}
				/>

				<PasswordStrength password={newPassword} />

				<Button
					primary
					large
					glow
					text={hasPassword ? t('personal_info.change_password_button') : t('personal_info.set_password_button')}
					error={passwordError}
					loading={passwordLoading}
					onClick={handlePasswordSubmit}
				/>
			</div>

			{/* Responsive: mobilde tek kolon */}
			<style>{`
				@media (max-width: 768px) {
					.personal-info-grid {
						grid-template-columns: 1fr !important;
					}
				}
			`}</style>
		</div>
	);
}
