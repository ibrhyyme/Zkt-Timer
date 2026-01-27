import React from 'react';
import './ReportProfile.scss';
import { gql } from '@apollo/client/core';
import { toastSuccess } from '../../../util/toast';
import Button from '../../common/button/Button';
import { PublicUserAccount, UserAccount, UserAccountForAdmin } from '../../../../server/schemas/UserAccount.schema';
import {
	PublicUserAccount as GqlPublicUserAccount,
	UserAccount as GqlUserAccount,
	UserAccountForAdmin as GqlUserAccountForAdmin,
} from '../../../@types/generated/graphql';
import { useMutation } from '@apollo/client';
import { useInput } from '../../../util/hooks/useInput';
import { IModalProps } from '../../common/modal/Modal';
import TextArea from '../../common/inputs/textarea/TextArea';
import block from '../../../styles/bem';
import ModalHeader from '../../common/modal/modal_header/ModalHeader';
import { Profile } from '../../../../server/schemas/Profile.schema';

const b = block('report-profile');

const REPORT_PROFILE_MUTATION = gql`
	mutation Mutate($userId: String, $reason: String) {
		reportProfile(userId: $userId, reason: $reason) {
			id
		}
	}
`;

// Combined type for user prop
type ReportUserType =
	| UserAccountForAdmin
	| PublicUserAccount
	| UserAccount
	| GqlUserAccountForAdmin
	| GqlPublicUserAccount
	| GqlUserAccount;

interface Props extends IModalProps {
	user?: ReportUserType;
}

export default function ReportUser(props: Props) {
	const { user } = props;

	const [reason, setReason] = useInput('');
	const [reportUser, reportUserData] = useMutation<
		{ reportProfile: Profile },
		{
			userId: string;
			reason: string;
		}
	>(REPORT_PROFILE_MUTATION);

	async function reportProfile() {
		if (reportUserData?.loading) {
			return;
		}

		await reportUser({
			variables: {
				userId: user.id,
				reason,
			},
		});

		toastSuccess(`Successfully reported ${user.username}. We will take care of the rest`);

		if (props.onComplete) {
			props.onComplete();
		}
	}

	const disabled = !reason.trim();
	return (
		<div className={b()}>
			<ModalHeader
				title={`Report ${user.username}`}
				description="Bu kullanıcının şikayete değer bir şey yaptığını düşünüyorsanız, lütfen aşağıya kısa bir gerekçe yazın ve şikayeti gönderin. Tüm şikayetleri adil bir şekilde inceleyeceğiz ve gerekirse harekete geçeceğiz."
			/>
			<TextArea legend="Reason" value={reason} name="reason" onChange={setReason} />
			<Button
				danger
				large
				glow
				primary
				disabled={disabled}
				loading={reportUserData?.loading}
				error={reportUserData?.error?.message}
				text="Şikayet Et"
				onClick={reportProfile}
			/>
		</div>
	);
}
