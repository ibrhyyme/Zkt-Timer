import React, {useEffect, useState} from 'react';
import './CompetitionProGifts.scss';
import {useDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {Plus, Trash, ListBullets, PencilSimple} from 'phosphor-react';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import ConfirmModal from '../../common/confirm_modal/ConfirmModal';
import {openModal} from '../../../actions/general';
import {gqlMutate, gqlQuery} from '../../api';
import {toastError, toastSuccess} from '../../../util/toast';
import {
	CompetitionCampaign,
	DELETE_COMPETITION_PRO_CAMPAIGN,
	GET_COMPETITION_GIFT_DATA,
	giftErrorKey,
} from './competition_gift_api';
import CompetitionGiftModal from './CompetitionGiftModal';
import CompetitionGiftListModal from './CompetitionGiftListModal';

const b = block('competition-pro-gifts');

// Admin > Promo > Competition: attach a Pro gift to a ZKT competition before its
// results are out. The hand-out runs on the server once the results are published
// (server/services/competition_pro_gift.ts).
export default function CompetitionProGifts() {
	const {t, i18n} = useTranslation('translation', {keyPrefix: 'admin_competition_gift'});
	const dispatch = useDispatch();
	const [campaigns, setCampaigns] = useState<CompetitionCampaign[]>([]);
	const [loading, setLoading] = useState(true);

	async function load() {
		try {
			const res = await gqlQuery(GET_COMPETITION_GIFT_DATA);
			setCampaigns(res?.data?.competitionProCampaigns || []);
		} catch (e) {
			toastError(t(giftErrorKey(e)));
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		load();
	}, []);

	function formatDate(value: string) {
		return new Date(value).toLocaleDateString(i18n.language, {day: 'numeric', month: 'long', year: 'numeric'});
	}

	function openCreate() {
		dispatch(
			openModal(<CompetitionGiftModal />, {
				title: t('modal_title_create'),
				width: 520,
				onComplete: load,
			})
		);
	}

	function openEdit(c: CompetitionCampaign) {
		dispatch(
			openModal(<CompetitionGiftModal campaign={c} />, {
				title: t('modal_title_edit'),
				width: 520,
				onComplete: load,
			})
		);
	}

	function openList(c: CompetitionCampaign) {
		dispatch(
			openModal(<CompetitionGiftListModal campaignId={c.id} />, {
				title: t('list_title', {name: c.competition_name}),
				width: 760,
			})
		);
	}

	function handleDelete(c: CompetitionCampaign) {
		dispatch(
			openModal(
				<ConfirmModal
					buttonText={t('delete_confirm_button')}
					hideInput
					triggerAction={async () => {
						try {
							await gqlMutate(DELETE_COMPETITION_PRO_CAMPAIGN, {id: c.id});
							toastSuccess(t('delete_success'));
						} catch (e) {
							toastError(t(giftErrorKey(e)));
						}
						load();
					}}
				/>,
				{
					title: t('delete_confirm_title'),
					description: t('delete_confirm_desc', {name: c.competition_name}),
					compact: true,
					width: 420,
				}
			)
		);
	}

	return (
		<div className={b()}>
			<div className={b('header')}>
				<div>
					<h2 className={b('title')}>{t('title')}</h2>
					<p className={b('subtitle')}>{t('subtitle')}</p>
				</div>
				<Button primary text={t('create_button')} icon={<Plus weight="bold" />} onClick={openCreate} />
			</div>

			{loading ? (
				<p className={b('empty')}>{t('loading')}</p>
			) : campaigns.length === 0 ? (
				<p className={b('empty')}>{t('empty')}</p>
			) : (
				<div className={b('table')}>
					<div className={b('row', {head: true})}>
						<span>{t('table_competition')}</span>
						<span>{t('table_date')}</span>
						<span>{t('table_newcomer')}</span>
						<span>{t('table_returning')}</span>
						<span>{t('table_status')}</span>
						<span>{t('table_progress')}</span>
						<span>{t('table_actions')}</span>
					</div>
					{campaigns.map((c) => {
						const armed = c.status === 'armed';
						return (
							<div key={c.id} className={b('row')}>
								<span className={b('name')}>{c.competition_name}</span>
								<span>{formatDate(c.competition_date)}</span>
								<span>{t('days', {count: c.newcomer_days})}</span>
								<span>{t('days', {count: c.returning_days})}</span>
								<span className={b('status', {[c.status]: true})}>{t(`status_${c.status}`)}</span>
								<span>
									{c.granted_count} / {c.waiting_count}
								</span>
								<span className={b('actions')}>
									<button
										type="button"
										className={b('action')}
										onClick={() => openList(c)}
										title={t('list_button')}
										aria-label={t('list_button')}
									>
										<ListBullets weight="bold" />
									</button>
									{armed && (
										<button
											type="button"
											className={b('action')}
											onClick={() => openEdit(c)}
											title={t('edit_button')}
											aria-label={t('edit_button')}
										>
											<PencilSimple weight="bold" />
										</button>
									)}
									{armed && (
										<button
											type="button"
											className={b('action', {delete: true})}
											onClick={() => handleDelete(c)}
											title={t('delete_button')}
											aria-label={t('delete_button')}
										>
											<Trash weight="bold" />
										</button>
									)}
								</span>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
