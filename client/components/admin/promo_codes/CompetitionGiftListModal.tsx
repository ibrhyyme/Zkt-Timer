import React, {useEffect, useState} from 'react';
import './CompetitionProGifts.scss';
import {useTranslation} from 'react-i18next';
import block from '../../../styles/bem';
import {IModalProps} from '../../common/modal/Modal';
import {gqlQuery} from '../../api';
import {CompetitionGift, GET_COMPETITION_PRO_GIFTS} from './competition_gift_api';

const b = block('competition-gift-list');

interface Props extends IModalProps {
	campaignId: string;
}

/** Everyone a competition gift was recorded for, and what happened to each one. */
export default function CompetitionGiftListModal(props: Props) {
	const {campaignId} = props;
	const {t, i18n} = useTranslation('translation', {keyPrefix: 'admin_competition_gift'});
	const [gifts, setGifts] = useState<CompetitionGift[] | null>(null);

	useEffect(() => {
		(async () => {
			try {
				const res = await gqlQuery(GET_COMPETITION_PRO_GIFTS, {campaignId});
				setGifts(res?.data?.competitionProGifts || []);
			} catch {
				setGifts([]);
			}
		})();
	}, [campaignId]);

	function formatDate(value?: string | null) {
		if (!value) return '';
		return new Date(value).toLocaleDateString(i18n.language, {day: 'numeric', month: 'short', year: 'numeric'});
	}

	function statusText(g: CompetitionGift) {
		const base = t(`gift_${g.status}`);
		return g.status === 'skipped' && g.skip_reason ? `${base} (${t(`skip_${g.skip_reason}`)})` : base;
	}

	if (gifts === null) return <p className={b('empty')}>{t('loading')}</p>;
	if (gifts.length === 0) return <p className={b('empty')}>{t('list_empty')}</p>;

	return (
		<div className={b()}>
			<div className={b('row', {head: true})}>
				<span>{t('col_name')}</span>
				<span>{t('col_user')}</span>
				<span>{t('col_kind')}</span>
				<span>{t('col_days')}</span>
				<span>{t('col_status')}</span>
				<span>{t('col_until')}</span>
			</div>
			{gifts.map((g) => (
				<div key={g.id} className={b('row')}>
					<span className={b('name')}>{g.name}</span>
					<span>{g.username || t('no_account')}</span>
					<span>{t(`kind_${g.kind}`)}</span>
					<span>{g.days}</span>
					<span className={b('status', {[g.status]: true})}>{statusText(g)}</span>
					<span>{formatDate(g.pro_until)}</span>
				</div>
			))}
		</div>
	);
}
