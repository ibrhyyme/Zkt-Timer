import React from 'react';
import './UserActions.scss';
import {gql} from '@apollo/client';
import {gqlMutate, gqlQuery} from '../../../api';
import {openModal} from '../../../../actions/general';
import BanUser from '../ban_user/BanUser';
import SetProModal from '../set_pro/SetProModal';
import block from '../../../../styles/bem';
import Button from '../../../common/button/Button';
import {toastSuccess} from '../../../../util/toast';
import {useDispatch} from 'react-redux';
import {UserAccountForAdmin} from '../../../../../server/schemas/UserAccount.schema';
import {useTranslation} from 'react-i18next';
import SendPushModal from '../send_push/SendPushModal';
import fileDownload from 'js-file-download';

const b = block('manage-user-actions');

interface Props {
	user: UserAccountForAdmin;
	updateUser: () => void;
}

export default function UserActions(props: Props) {
	const dispatch = useDispatch();
	const {t} = useTranslation('translation', {keyPrefix: 'admin_users.manage_user'});

	const {user, updateUser} = props;
	const banned = user.banned_forever || user.banned_until;

	async function unbanUser() {
		const query = gql`
			mutation Mutate($userId: String) {
				unbanUserAccount(userId: $userId) {
					id
				}
			}
		`;

		await gqlMutate(query, {
			userId: user.id,
		});

		updateUser();
		toastSuccess(t('user_unbanned'));
	}

	async function toggleVerifyUser() {
		const query = gql`
			mutation Mutate($userId: String, $verified: Boolean) {
				setVerifiedStatus(userId: $userId, verified: $verified) {
					id
					verified
				}
			}
		`;

		await gqlMutate(query, {
			userId: user.id,
			verified: !user.verified,
		});

		updateUser();
		toastSuccess(user.verified ? t('user_unverified') : t('user_verified'));
	}

	// Mod = competition manager only (access to the /organizer pages); no other
	// admin/moderation capability. Granting/revoking is admin-only on the server.
	async function toggleModStatus() {
		const query = gql`
			mutation Mutate($userId: String, $isMod: Boolean) {
				setModStatus(userId: $userId, isMod: $isMod) {
					id
					mod
				}
			}
		`;

		await gqlMutate(query, {
			userId: user.id,
			isMod: !user.mod,
		});

		updateUser();
		toastSuccess(user.mod ? t('mod_removed') : t('mod_granted'));
	}

	function toggleProStatus() {
		if (user.is_pro) {
			// Remove Pro
			const query = gql`
				mutation Mutate($userId: String, $isPro: Boolean) {
					setProStatus(userId: $userId, isPro: $isPro) {
						id
						is_pro
						pro_expires_at
					}
				}
			`;
			gqlMutate(query, {userId: user.id, isPro: false}).then(() => {
				updateUser();
				toastSuccess(t('pro_removed', {username: user.username}));
			});
		} else {
			// Open duration modal
			dispatch(openModal(<SetProModal user={user} type="pro" />, {onComplete: updateUser}));
		}
	}

	function togglePremiumStatus() {
		if (user.is_premium) {
			const query = gql`
				mutation Mutate($userId: String, $isPremium: Boolean) {
					setPremiumStatus(userId: $userId, isPremium: $isPremium) {
						id
						is_premium
						premium_expires_at
					}
				}
			`;
			gqlMutate(query, {userId: user.id, isPremium: false}).then(() => {
				updateUser();
				toastSuccess(t('premium_removed', {username: user.username}));
			});
		} else {
			dispatch(openModal(<SetProModal user={user} type="premium" />, {onComplete: updateUser}));
		}
	}

	async function deleteUser() {
		if (!window.confirm(t('delete_confirm', {username: user.username}))) {
			return;
		}

		const query = gql`
			mutation Mutate($userId: String!) {
				adminDeleteUserAccount(userId: $userId) {
					id
				}
			}
		`;

		await gqlMutate(query, {
			userId: user.id,
		});

		toastSuccess(t('user_deleted'));
		updateUser();
	}

	async function exportUserData() {
		const query = gql`
			query Query($userId: String!) {
				adminExportUserData(userId: $userId)
			}
		`;

		const res = await gqlQuery<{adminExportUserData: string}>(query, {userId: user.id});
		fileDownload(res.data.adminExportUserData, `zkttimer_data_${user.username}.txt`);
		toastSuccess(t('user_data_exported'));
	}

	function toggleBan() {
		if (banned) {
			unbanUser();
		} else {
			dispatch(
				openModal(<BanUser user={user} />, {
					onComplete: updateUser,
				})
			);
		}
	}

	return (
		<div className={b()}>
			<Button text={banned ? t('unban_user') : t('ban_user')} onClick={toggleBan} danger />
			<Button
				text={user.verified ? t('unverify_user') : t('verify_user')}
				primary={!user.verified}
				warning={user.verified}
				onClick={toggleVerifyUser}
			/>
			<Button
				text={user.mod ? t('remove_mod') : t('make_mod')}
				primary={!user.mod}
				warning={user.mod}
				onClick={toggleModStatus}
			/>
			<Button
				text={user.is_pro ? t('remove_pro') : t('make_pro')}
				primary={!user.is_pro}
				warning={user.is_pro}
				onClick={toggleProStatus}
			/>
			<Button
				text={user.is_premium ? t('remove_premium') : t('make_premium')}
				primary={!user.is_premium}
				warning={user.is_premium}
				onClick={togglePremiumStatus}
			/>
			<Button text={t('delete_user')} danger onClick={deleteUser} />
			<Button
				text={t('send_push')}
				primary
				onClick={() => dispatch(openModal(
					<SendPushModal userId={user.id} username={user.username} />,
					{title: t('send_push'), width: 400}
				))}
			/>
			<Button text={t('export_user_data')} onClick={exportUserData} />
		</div>
	);
}
