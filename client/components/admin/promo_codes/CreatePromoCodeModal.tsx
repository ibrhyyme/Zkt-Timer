import React from 'react';
import './CreatePromoCodeModal.scss';
import Checkbox from '../../common/checkbox/Checkbox';
import block from '../../../styles/bem';
import {useToggle} from '../../../util/hooks/useToggle';
import {useInput} from '../../../util/hooks/useInput';
import {IModalProps} from '../../common/modal/Modal';
import {useTranslation} from 'react-i18next';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {toastSuccess, toastError} from '../../../util/toast';
import {Crown} from 'phosphor-react';

const b = block('create-promo-code-modal');

const CREATE_PROMO_CODE = gql`
	mutation CreatePromoCode($input: CreatePromoCodeInput!) {
		createPromoCode(input: $input) {
			id
			code
		}
	}
`;

export default function CreatePromoCodeModal(props: IModalProps) {
	const {t} = useTranslation('translation', {keyPrefix: 'admin_promo_codes'});

	const [code, setCode] = useInput('');
	const [membershipType, setMembershipType] = useInput('pro');
	const [durationCount, setDurationCount] = useInput(1);
	const [durationUnit, setDurationUnit] = useInput('day');
	const [maxUses, setMaxUses] = useInput(1);
	const [forever, toggleForever] = useToggle(false);

	function getDurationMinutes(): number {
		if (forever) return -1;

		const multipliers: Record<string, number> = {
			minute: 1,
			hour: 60,
			day: 60 * 24,
			week: 60 * 24 * 7,
			month: 60 * 24 * 30,
			year: 60 * 24 * 365,
		};

		let count = durationCount;
		if (typeof count === 'string') count = parseInt(count, 10);
		if (!count || count < 1) return 1;

		return count * (multipliers[durationUnit] || 1);
	}

	async function handleSubmit() {
		const trimmedCode = typeof code === 'string' ? code.trim() : '';
		if (!trimmedCode) return;

		let uses = maxUses;
		if (typeof uses === 'string') uses = parseInt(uses, 10);
		if (!uses || uses < 1) uses = 1;

		try {
			await gqlMutate(CREATE_PROMO_CODE, {
				input: {
					code: trimmedCode.toUpperCase(),
					membership_type: membershipType,
					duration_minutes: getDurationMinutes(),
					max_uses: uses,
				},
			});

			toastSuccess(t('create_success', {code: trimmedCode.toUpperCase()}));
			props.onComplete();
		} catch (e: any) {
			toastError(e?.message || 'Error creating code');
		}
	}

	return (
		<div className={b()}>
			<div className={b('header')}>
				<div className={b('icon')}>
					<Crown weight="fill" />
				</div>
				<h2 className={b('title')}>{t('create_title')}</h2>
			</div>

			<div className={b('form')}>
				<div className={b('field')}>
					<label className={b('label')}>{t('code_label')}</label>
					<input
						className={b('input')}
						placeholder={t('code_placeholder')}
						value={code}
						onChange={(e) => setCode(e.target.value.toUpperCase())}
					/>
				</div>

				<div className={b('field')}>
					<label className={b('label')}>{t('type_label')}</label>
					<select
						className={b('select')}
						value={membershipType}
						onChange={(e) => setMembershipType(e.target.value)}
					>
						<option value="pro">{t('type_pro')}</option>
						<option value="premium">{t('type_premium')}</option>
					</select>
				</div>

				<div className={b('duration', {forever})}>
					<div className={b('field')}>
						<label className={b('label')}>{t('duration_label')}</label>
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
						<label className={b('label')}>{t('unit_label')}</label>
						<select
							disabled={forever}
							className={b('select')}
							value={durationUnit}
							onChange={(e) => setDurationUnit(e.target.value)}
						>
							<option value="minute">{t('unit_minute')}</option>
							<option value="hour">{t('unit_hour')}</option>
							<option value="day">{t('unit_day')}</option>
							<option value="week">{t('unit_week')}</option>
							<option value="month">{t('unit_month')}</option>
							<option value="year">{t('unit_year')}</option>
						</select>
					</div>
				</div>

				<Checkbox text={t('forever')} onChange={() => toggleForever()} checked={forever} />

				<div className={b('field')}>
					<label className={b('label')}>{t('max_uses_label')}</label>
					<input
						type="number"
						min="1"
						className={b('input')}
						value={maxUses}
						onChange={(e) => setMaxUses(e.target.value)}
					/>
				</div>
			</div>

			<button type="button" className={b('cta')} onClick={handleSubmit}>
				{t('create_submit')}
			</button>
		</div>
	);
}
