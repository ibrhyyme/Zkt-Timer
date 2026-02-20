import React from 'react';
import './BanUser.scss';
import Checkbox from '../../../common/checkbox/Checkbox';
import Input from '../../../common/inputs/input/Input';
import Select from '../../../common/inputs/select/Select';
import { gql, useMutation } from '@apollo/client';
import { toastSuccess } from '../../../../util/toast';
import TextArea from '../../../common/inputs/textarea/TextArea';
import Button from '../../../common/button/Button';
import block from '../../../../styles/bem';
import { useToggle } from '../../../../util/hooks/useToggle';
import { useInput } from '../../../../util/hooks/useInput';
import { IModalProps } from '../../../common/modal/Modal';
import ModalHeader from '../../../common/modal/modal_header/ModalHeader';
import { BanUserInput } from '../../../../../server/schemas/BanLog.schema';
import { UserAccount, UserAccountForAdmin } from '../../../../../server/schemas/UserAccount.schema';
import { useTranslation } from 'react-i18next';

const b = block('ban-user');

const BAN_USER_MUTATION = gql`
	mutation Mutate($input: BanUserInput) {
		banUserAccount(input: $input) {
			id
		}
	}
`;

interface Props extends IModalProps {
	user: UserAccount | UserAccountForAdmin;
}

export default function BanUser(props: Props) {
	const { user } = props;
	const { t } = useTranslation();

	const [cheatingIn1v1, toggleCheatingIn1v1] = useToggle(false);
	const [deletePublishedSolves, toggleDeletePublishedSolves] = useToggle(true);
	const [durationCount, setDurationCount] = useInput(1);
	const [durationUnit, setDurationUnit] = useInput('day');
	const [reason, setReason] = useInput('');
	const [forever, toggleForever] = useToggle(false);

	const [banUser, banUserData] = useMutation<
		{ banUserAccount: UserAccount },
		{
			input: BanUserInput;
		}
	>(BAN_USER_MUTATION);

	const error = banUserData?.error?.message;
	const loading = banUserData?.loading;

	function getDurationMinutes() {
		const multipliers = {
			minute: 1,
			hour: 60,
			day: 60 * 24,
			week: 60 * 24 * 7,
			month: 60 * 24 * 30,
			year: 60 * 24 * 365,
		};

		let duration = durationCount;
		if (typeof duration === 'string') {
			duration = parseInt(duration, 10);
		}

		if (!multipliers[durationUnit]) {
			throw new Error('Invalid duration type');
		}

		if (!duration || duration < 0) {
			throw new Error('Invalid duration');
		}

		if (duration > 100) {
			throw new Error('Duration count cannot be over 100');
		}

		let minutes = duration * multipliers[durationUnit];
		let durationText = `${duration} ${durationUnit}${duration === 1 ? '' : 's'}`;

		if (forever) {
			durationText = t('admin_users.forever');
			minutes = -1;
		}

		return {
			durationText,
			minutes,
		};
	}

	async function submitBan() {
		if (loading) {
			return;
		}

		const { minutes, durationText } = getDurationMinutes();
		await banUser({
			variables: {
				input: {
					user_id: user.id,
					minutes,
					reason,
					cheating_in_1v1: cheatingIn1v1,
					delete_published_solves: deletePublishedSolves,
				},
			},
		});

		toastSuccess(t('admin_users.user_banned', { username: user.username, duration: durationText }));
		props.onComplete();
	}

	const disabled = loading || !reason;

	return (
		<div className={b()}>
			<ModalHeader
				title={t('admin_users.ban_user', { username: user.username })}
				description={t('admin_users.ban_description')}
			/>
			<TextArea
				autoSize
				fullWidth
				onChange={setReason}
				name="reason"
				legend={t('admin_users.ban_reason')}
				value={reason}
			/>
			<div className={b('duration', { forever })}>
				<Input
					disabled={forever}
					legend={t('admin_users.duration')}
					type="number"
					name="durationCount"
					value={durationCount}
					onChange={setDurationCount}
				/>
				<Select
					disabled={forever}
					legend={t('admin_users.duration_unit')}
					name="durationType"
					value={durationUnit}
					onChange={setDurationUnit}
				>
					<option value="minute">{t('admin_users.minute')}</option>
					<option value="hour">{t('admin_users.hour')}</option>
					<option value="day">{t('admin_users.day')}</option>
					<option value="week">{t('admin_users.week')}</option>
					<option value="month">{t('admin_users.month')}</option>
					<option value="year">{t('admin_users.year')}</option>
				</Select>
			</div>
			<div className={b('options')}>
				<Checkbox
					text={t('admin_users.delete_published_solves')}
					onChange={() => toggleDeletePublishedSolves()}
					checked={deletePublishedSolves}
				/>
				<Checkbox text={t('admin_users.ban_permanently')} onChange={() => toggleForever()} checked={forever} />
				<Checkbox
					text={t('admin_users.cheater_elo_refund')}
					onChange={() => toggleCheatingIn1v1()}
					checked={cheatingIn1v1}
				/>
			</div>
			<Button
				text={t('admin_users.ban_button')}
				disabled={disabled}
				danger
				large
				glow
				onClick={submitBan}
				loading={loading}
				error={error}
			/>
		</div>
	);
}
