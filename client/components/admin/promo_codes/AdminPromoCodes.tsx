import React, {useEffect, useState} from 'react';
import './AdminPromoCodes.scss';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {openModal} from '../../../actions/general';
import {useDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {Plus, Crown} from 'phosphor-react';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import {toastSuccess, toastError} from '../../../util/toast';
import CreatePromoCodeModal from './CreatePromoCodeModal';

const b = block('admin-promo-codes');

const GET_PROMO_CODES = gql`
	query GetPromoCodes {
		getPromoCodes {
			id
			code
			membership_type
			duration_minutes
			max_uses
			current_uses
			is_active
			expires_at
			created_at
		}
	}
`;

interface PromoCodeItem {
	id: string;
	code: string;
	membership_type: string;
	duration_minutes: number;
	max_uses: number;
	current_uses: number;
	is_active: boolean;
	expires_at?: string;
	created_at: string;
}

function formatDuration(minutes: number, t: (key: string) => string): string {
	if (minutes === -1) return t('forever');
	if (minutes < 60) return `${minutes} ${t('duration_minute')}`;
	if (minutes < 1440) return `${Math.round(minutes / 60)} ${t('duration_hour')}`;
	if (minutes < 10080) return `${Math.round(minutes / 1440)} ${t('duration_day')}`;
	if (minutes < 43200) return `${Math.round(minutes / 10080)} ${t('duration_week')}`;
	if (minutes < 525600) return `${Math.round(minutes / 43200)} ${t('duration_month')}`;
	return `${Math.round(minutes / 525600)} ${t('duration_year')}`;
}

export default function AdminPromoCodes() {
	const {t} = useTranslation('translation', {keyPrefix: 'admin_promo_codes'});
	const dispatch = useDispatch();
	const [codes, setCodes] = useState<PromoCodeItem[]>([]);
	const [loading, setLoading] = useState(true);

	async function fetchCodes() {
		try {
			const result = await gqlMutate(GET_PROMO_CODES, {});
			setCodes(result?.data?.getPromoCodes || []);
		} catch {
			toastError('Failed to load promo codes');
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		fetchCodes();
	}, []);

	async function toggleActive(id: string, isActive: boolean) {
		const query = gql`
			mutation Toggle($id: String!, $isActive: Boolean!) {
				togglePromoCodeActive(id: $id, isActive: $isActive) {
					id
					is_active
				}
			}
		`;

		try {
			await gqlMutate(query, {id, isActive});
			toastSuccess(t('toggle_success'));
			fetchCodes();
		} catch {
			toastError('Failed to toggle code');
		}
	}

	function openCreate() {
		dispatch(
			openModal(<CreatePromoCodeModal />, {
				closeButtonText: 'Bitti',
				onComplete: fetchCodes,
			})
		);
	}

	return (
		<div className={b()}>
			<div className={b('header')}>
				<div>
					<h2 className={b('title')}>{t('title')}</h2>
					<p className={b('subtitle')}>{t('subtitle')}</p>
				</div>
				<Button primary glow text={t('create_button')} icon={<Plus weight="bold" />} onClick={openCreate} />
			</div>

			{loading ? (
				<p className={b('empty')}>{t('loading')}</p>
			) : codes.length === 0 ? (
				<p className={b('empty')}>{t('no_codes')}</p>
			) : (
				<div className={b('table')}>
					<div className={b('table-header')}>
						<span>{t('table_code')}</span>
						<span>{t('table_type')}</span>
						<span>{t('table_duration')}</span>
						<span>{t('table_uses')}</span>
						<span>{t('table_status')}</span>
					</div>
					{codes.map((code) => (
						<div key={code.id} className={b('table-row', {inactive: !code.is_active})}>
							<span className={b('code')}>
								<Crown weight="fill" className={b('code-icon')} />
								{code.code}
							</span>
							<span className={b('type', {[code.membership_type]: true})}>
								{code.membership_type === 'pro' ? 'Pro' : 'Premium'}
							</span>
							<span>{formatDuration(code.duration_minutes, t)}</span>
							<span>{code.current_uses}/{code.max_uses}</span>
							<span>
								<button
									type="button"
									className={b('status-btn', {active: code.is_active})}
									onClick={() => toggleActive(code.id, !code.is_active)}
								>
									{code.is_active ? t('active') : t('inactive')}
								</button>
							</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
