import React, {useEffect, useState} from 'react';
import './ManagePromoCodeModal.scss';
import block from '../../../styles/bem';
import {IModalProps} from '../../common/modal/Modal';
import {useTranslation} from 'react-i18next';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {Crown, User} from 'phosphor-react';

const b = block('manage-promo-code-modal');

const GET_REDEMPTIONS = gql`
	query GetPromoCodeRedemptions($promoCodeId: String!) {
		getPromoCodeRedemptions(promoCodeId: $promoCodeId) {
			id
			username
			redeemed_at
		}
	}
`;

interface RedemptionItem {
	id: string;
	username: string;
	redeemed_at: string;
}

interface ManagePromoCodeModalProps extends IModalProps {
	promoCodeId: string;
	code: string;
}

export default function ManagePromoCodeModal(props: ManagePromoCodeModalProps) {
	const {promoCodeId, code} = props;
	const {t, i18n} = useTranslation('translation', {keyPrefix: 'admin_promo_codes'});
	const [redemptions, setRedemptions] = useState<RedemptionItem[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		(async () => {
			try {
				const result = await gqlMutate(GET_REDEMPTIONS, {promoCodeId});
				setRedemptions(result?.data?.getPromoCodeRedemptions || []);
			} catch {
				// silent
			} finally {
				setLoading(false);
			}
		})();
	}, [promoCodeId]);

	return (
		<div className={b()}>
			<div className={b('header')}>
				<div className={b('icon')}>
					<Crown weight="fill" />
				</div>
				<h2 className={b('title')}>
					{t('manage_title')} — {code}
				</h2>
			</div>

			<div className={b('list')}>
				{loading ? (
					<p className={b('empty')}>{t('loading')}</p>
				) : redemptions.length === 0 ? (
					<p className={b('empty')}>{t('manage_empty')}</p>
				) : (
					redemptions.map((r) => (
						<div key={r.id} className={b('card')}>
							<div className={b('card-user')}>
								<User weight="bold" className={b('card-icon')} />
								<span>{r.username}</span>
							</div>
							<span className={b('card-date')}>
								{new Date(r.redeemed_at).toLocaleDateString(i18n.language, {
									year: 'numeric',
									month: 'short',
									day: 'numeric',
								})}
							</span>
						</div>
					))
				)}
			</div>
		</div>
	);
}
