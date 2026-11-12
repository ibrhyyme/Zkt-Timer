import React, {useEffect, useState} from 'react';
import './CompetitionProGifts.scss';
import {useTranslation} from 'react-i18next';
import block from '../../../styles/bem';
import SelectMenu from '../../common/select_menu/SelectMenu';
import Button from '../../common/button/Button';
import {IModalProps} from '../../common/modal/Modal';
import {gqlMutate, gqlQuery} from '../../api';
import {toastError, toastSuccess} from '../../../util/toast';
import {
	CompetitionCampaign,
	CREATE_COMPETITION_PRO_CAMPAIGN,
	GET_PRO_GIFT_COMPETITIONS,
	GiftCompetitionOption,
	giftErrorKey,
	UPDATE_COMPETITION_PRO_CAMPAIGN,
} from './competition_gift_api';

const b = block('competition-gift-modal');

const DEFAULT_NEWCOMER_DAYS = 30;
const DEFAULT_RETURNING_DAYS = 14;

interface Props extends IModalProps {
	/** Editing an existing gift; the competition is then fixed. */
	campaign?: CompetitionCampaign;
}

function toDays(value: string): number {
	const n = parseInt(value, 10);
	return Number.isFinite(n) ? n : 0;
}

export default function CompetitionGiftModal(props: Props) {
	const {campaign} = props;
	const {t} = useTranslation('translation', {keyPrefix: 'admin_competition_gift'});
	const [options, setOptions] = useState<GiftCompetitionOption[] | null>(campaign ? [] : null);
	const [federationDown, setFederationDown] = useState(false);
	const [competitionId, setCompetitionId] = useState('');
	const [newcomerDays, setNewcomerDays] = useState(String(campaign?.newcomer_days ?? DEFAULT_NEWCOMER_DAYS));
	const [returningDays, setReturningDays] = useState(String(campaign?.returning_days ?? DEFAULT_RETURNING_DAYS));
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (campaign) return;
		(async () => {
			try {
				const res = await gqlQuery(GET_PRO_GIFT_COMPETITIONS);
				const all: GiftCompetitionOption[] = res?.data?.proGiftCompetitions || [];
				// Only competitions whose results are not out and that have no gift yet.
				const open = all.filter((c) => !c.results_published && !c.campaign_id);
				setOptions(open);
				if (open.length > 0) setCompetitionId(open[0].zkt_competition_id);
			} catch {
				setFederationDown(true);
				setOptions([]);
			}
		})();
	}, []);

	async function submit() {
		const newcomer = toDays(newcomerDays);
		const returning = toDays(returningDays);
		if (newcomer < 1 || newcomer > 365 || returning < 1 || returning > 365) {
			toastError(t('error_invalid_days'));
			return;
		}
		setSaving(true);
		try {
			if (campaign) {
				await gqlMutate(UPDATE_COMPETITION_PRO_CAMPAIGN, {
					id: campaign.id,
					newcomerDays: newcomer,
					returningDays: returning,
				});
			} else {
				await gqlMutate(CREATE_COMPETITION_PRO_CAMPAIGN, {
					input: {zkt_competition_id: competitionId, newcomer_days: newcomer, returning_days: returning},
				});
			}
			toastSuccess(t('save_success'));
			props.onComplete?.();
		} catch (e) {
			toastError(t(giftErrorKey(e)));
			setSaving(false);
		}
	}

	const loadingOptions = options === null;
	const noOptions = !campaign && options !== null && options.length === 0;

	return (
		<div className={b()}>
			<div className={b('field')}>
				<label className={b('label')}>{t('competition_label')}</label>
				{campaign ? (
					<p className={b('fixed')}>{campaign.competition_name}</p>
				) : loadingOptions ? (
					<p className={b('note')}>{t('loading')}</p>
				) : federationDown ? (
					<p className={b('note')}>{t('federation_error')}</p>
				) : noOptions ? (
					<p className={b('note')}>{t('no_competition')}</p>
				) : (
					<SelectMenu
						fullWidth
						value={competitionId}
						onChange={setCompetitionId}
						ariaLabel={t('competition_label')}
						options={(options || []).map((c) => ({
							value: c.zkt_competition_id,
							label: `${c.name} (${c.date_start})`,
						}))}
					/>
				)}
			</div>

			<div className={b('days')}>
				<div className={b('field')}>
					<label className={b('label')} htmlFor="gift-newcomer-days">
						{t('newcomer_label')}
					</label>
					<input
						id="gift-newcomer-days"
						type="number"
						min="1"
						max="365"
						className={b('input')}
						value={newcomerDays}
						onChange={(e) => setNewcomerDays(e.target.value)}
					/>
				</div>
				<div className={b('field')}>
					<label className={b('label')} htmlFor="gift-returning-days">
						{t('returning_label')}
					</label>
					<input
						id="gift-returning-days"
						type="number"
						min="1"
						max="365"
						className={b('input')}
						value={returningDays}
						onChange={(e) => setReturningDays(e.target.value)}
					/>
				</div>
			</div>

			<div className={b('rules')}>
				<p className={b('rules-title')}>{t('rules_title')}</p>
				<ul>
					<li>{t('rule_once')}</li>
					<li>{t('rule_attempt')}</li>
					<li>{t('rule_newcomer')}</li>
					<li>{t('rule_store')}</li>
					<li>{t('rule_link')}</li>
					<li>{t('rule_lock')}</li>
				</ul>
			</div>

			<Button
				primary
				large
				fullWidth
				text={t('submit')}
				loading={saving}
				disabled={saving || (!campaign && (!competitionId || noOptions || loadingOptions))}
				onClick={submit}
			/>
		</div>
	);
}
