import React from 'react';
import './SetProModal.scss';
import Checkbox from '../../../common/checkbox/Checkbox';
import block from '../../../../styles/bem';
import {useToggle} from '../../../../util/hooks/useToggle';
import {useInput} from '../../../../util/hooks/useInput';
import {IModalProps} from '../../../common/modal/Modal';
import {UserAccountForAdmin} from '../../../../../server/schemas/UserAccount.schema';
import {useTranslation} from 'react-i18next';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {toastSuccess} from '../../../../util/toast';
import {Crown} from 'phosphor-react';

const b = block('set-pro-modal');

interface Props extends IModalProps {
	user: UserAccountForAdmin;
	type: 'pro' | 'premium';
}

export default function SetProModal(props: Props) {
	const {user, type} = props;
	const {t} = useTranslation('translation', {keyPrefix: 'admin_users.manage_user'});

	const [durationCount, setDurationCount] = useInput(1);
	const [durationUnit, setDurationUnit] = useInput('day');
	const [forever, toggleForever] = useToggle(false);

	const label = type === 'pro' ? 'Pro' : 'Premium';

	function getDurationMinutes() {
		const multipliers: Record<string, number> = {
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

		if (!multipliers[durationUnit]) throw new Error('Invalid duration type');
		if (!duration || duration < 0) throw new Error('Invalid duration');
		if (duration > 100) throw new Error('Duration count cannot be over 100');

		let minutes = duration * multipliers[durationUnit];
		let durationText = `${duration} ${t(`duration_${durationUnit}`)}`;

		if (forever) {
			durationText = t('forever');
			minutes = -1;
		}

		return {durationText, minutes};
	}

	async function handleSubmit() {
		const {minutes, durationText} = getDurationMinutes();

		if (type === 'pro') {
			const query = gql`
				mutation Mutate($userId: String, $isPro: Boolean, $minutes: Float) {
					setProStatus(userId: $userId, isPro: $isPro, minutes: $minutes) {
						id
						is_pro
						pro_expires_at
					}
				}
			`;

			await gqlMutate(query, {
				userId: user.id,
				isPro: true,
				minutes: forever ? null : minutes,
			});
		} else {
			const query = gql`
				mutation Mutate($userId: String, $isPremium: Boolean, $minutes: Float) {
					setPremiumStatus(userId: $userId, isPremium: $isPremium, minutes: $minutes) {
						id
						is_premium
						premium_expires_at
					}
				}
			`;

			await gqlMutate(query, {
				userId: user.id,
				isPremium: true,
				minutes: forever ? null : minutes,
			});
		}

		toastSuccess(t('pro_set_success', {username: user.username, type: label, duration: durationText}));
		props.onComplete();
	}

	return (
		<div className={b()}>
			<div className={b('header')}>
				<div className={b('icon')}>
					<Crown weight="fill" />
				</div>
				<h2 className={b('title')}>{t('set_pro_title', {username: user.username, type: label})}</h2>
				<p className={b('desc')}>{t('set_pro_desc', {type: label})}</p>
			</div>

			<div className={b('duration', {forever})}>
				<div className={b('field')}>
					<label className={b('label')}>{t('pro_duration')}</label>
					<input
						disabled={forever}
						type="number"
						min="1"
						max="100"
						className={b('input')}
						value={durationCount}
						onChange={(e) => setDurationCount(e.target.value)}
					/>
				</div>
				<div className={b('field')}>
					<label className={b('label')}>{t('pro_duration_unit')}</label>
					<select
						disabled={forever}
						className={b('select')}
						value={durationUnit}
						onChange={(e) => setDurationUnit(e.target.value)}
					>
						<option value="minute">{t('duration_minute')}</option>
						<option value="hour">{t('duration_hour')}</option>
						<option value="day">{t('duration_day')}</option>
						<option value="week">{t('duration_week')}</option>
						<option value="month">{t('duration_month')}</option>
						<option value="year">{t('duration_year')}</option>
					</select>
				</div>
			</div>

			<div className={b('options')}>
				<Checkbox text={t('pro_forever')} onChange={() => toggleForever()} checked={forever} />
			</div>

			<button type="button" className={b('cta')} onClick={handleSubmit}>
				{t('set_pro_button', {type: label})}
			</button>
		</div>
	);
}
