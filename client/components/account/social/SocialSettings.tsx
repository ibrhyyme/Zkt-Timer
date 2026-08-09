import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import Checkbox from '../../common/checkbox/Checkbox';
import InputLegend from '../../common/inputs/input/input_legend/InputLegend';
import Loading from '../../common/loading/Loading';
import Button from '../../common/button/Button';
import AvatarImage from '../../common/avatar/avatar_image/AvatarImage';
import {gqlMutateTyped, gqlQueryTyped} from '../../api';
import {
	SocialPreferenceDocument,
	SocialPreferenceQuery,
	UpdateSocialPreferenceDocument,
	BlockedUsersDocument,
	BlockedUsersQuery,
	UnblockUserDocument,
	DmPolicy,
} from '../../../@types/generated/graphql';
import {toastError} from '../../../util/toast';
import block from '../../../styles/bem';
import './SocialSettings.scss';

const b = block('social-settings');

type Prefs = SocialPreferenceQuery['socialPreference'];
type Blocked = BlockedUsersQuery['blockedUsers'][number];

export default function SocialSettings() {
	const {t} = useTranslation();
	const [prefs, setPrefs] = useState<Prefs | null>(null);
	const [blocked, setBlocked] = useState<Blocked[]>([]);
	const [loading, setLoading] = useState(true);

	async function load() {
		setLoading(true);
		try {
			const [prefRes, blockRes] = await Promise.all([
				gqlQueryTyped(SocialPreferenceDocument, {}, {fetchPolicy: 'no-cache'}),
				gqlQueryTyped(BlockedUsersDocument, {}, {fetchPolicy: 'no-cache'}),
			]);
			setPrefs(prefRes?.data?.socialPreference ?? null);
			setBlocked((blockRes?.data?.blockedUsers || []) as Blocked[]);
		} catch (e) {
			toastError(e as Error);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		void load();
	}, []);

	async function update(patch: Record<string, any>) {
		if (!prefs) return;
		const previous = prefs;
		setPrefs({...prefs, ...patch});

		try {
			const res = await gqlMutateTyped(UpdateSocialPreferenceDocument, {input: patch});
			if (res?.data?.updateSocialPreference) {
				setPrefs(res.data.updateSocialPreference);
			}
		} catch (e) {
			setPrefs(previous);
			toastError(e as Error);
		}
	}

	async function unblock(userId: string) {
		try {
			await gqlMutateTyped(UnblockUserDocument, {userId});
			setBlocked((prev) => prev.filter((row) => row.user?.id !== userId));
		} catch (e) {
			toastError(e as Error);
		}
	}

	if (loading || !prefs) {
		return <Loading />;
	}

	// Three named choices instead of a pair of toggles: "who may reach me" is one
	// decision, and splitting it would let people set states that contradict.
	const policies: {value: DmPolicy; label: string; hint: string}[] = [
		{value: DmPolicy.Everyone, label: t('social.policy_everyone'), hint: t('social.policy_everyone_hint')},
		{value: DmPolicy.Known, label: t('social.policy_known'), hint: t('social.policy_known_hint')},
		{value: DmPolicy.Nobody, label: t('social.policy_nobody'), hint: t('social.policy_nobody_hint')},
	];

	return (
		<div className={b()}>
			<InputLegend text={t('social.who_can_message')} />
			<div className={b('policies')}>
				{policies.map((policy) => (
					<button
						key={policy.value}
						type="button"
						className={b('policy', {active: prefs.dm_policy === policy.value})}
						onClick={() => update({dm_policy: policy.value})}
					>
						<span className={b('policy-label')}>{policy.label}</span>
						<span className={b('policy-hint')}>{policy.hint}</span>
					</button>
				))}
			</div>

			<InputLegend text={t('social.visibility')} />
			<Checkbox
				name="searchable"
				text={t('social.searchable')}
				checked={prefs.searchable}
				onChange={(e: any) => update({searchable: e.target.checked})}
			/>

			{/* Both are reciprocal on the server: switching one off stops your state
			    being sent AND stops theirs reaching you. The descriptions say so out
			    loud, because a privacy switch that quietly keeps taking from others
			    would be a surveillance feature wearing a privacy label. */}
			<InputLegend text={t('social.read_receipts')} />
			<Checkbox
				name="read_receipts"
				text={t('social.read_receipts')}
				checked={prefs.read_receipts}
				onChange={(e: any) => update({read_receipts: e.target.checked})}
			/>
			<p className={b('hint')}>{t('social.read_receipts_desc')}</p>

			<Checkbox
				name="typing_indicator"
				text={t('social.typing_indicator')}
				checked={prefs.typing_indicator}
				onChange={(e: any) => update({typing_indicator: e.target.checked})}
			/>
			<p className={b('hint')}>{t('social.typing_indicator_desc')}</p>

			<Checkbox
				name="online_status"
				text={t('social.online_status')}
				checked={prefs.online_status}
				onChange={(e: any) => update({online_status: e.target.checked})}
			/>
			<p className={b('hint')}>{t('social.online_status_desc')}</p>

			<InputLegend text={t('social.notifications')} />
			<Checkbox
				name="dm_push"
				text={t('social.dm_push')}
				checked={prefs.dm_push}
				onChange={(e: any) => update({dm_push: e.target.checked})}
			/>

			<InputLegend text={t('social.blocked')} />
			{blocked.length === 0 ? (
				<p className={b('empty')}>{t('social.no_blocked')}</p>
			) : (
				<div className={b('blocked')}>
					{blocked.map((row) => (
						<div key={row.id} className={b('blocked-row')}>
							<AvatarImage small user={row.user as any} profile={(row.user as any)?.profile} />
							<span className={b('blocked-name')}>{row.user?.username}</span>
							<Button gray small text={t('social.unblock')} onClick={() => unblock(row.user?.id)} />
						</div>
					))}
				</div>
			)}

			<p className={b('footnote')}>
				{t('social.footnote')} <Link to="/messages">{t('messages.page_title')}</Link>
			</p>
		</div>
	);
}
