import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Copy, ShareNetwork, Check} from 'phosphor-react';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import {getApiBase} from '../../../util/api-base';
import {isNative} from '../../../util/platform';
import {shareContent} from '../../../util/native-plugins';
import {copyText} from '../../../util/clipboard';
import {toastError} from '../../../util/toast';
import {ROUNDS_TO_WIN} from '../../../../shared/battle/config';
import {challengePath} from '../../../../shared/battle/challenge';
import type {ChallengeStatePayload} from '../../../../shared/battle/events';
import type {QueueCubeView} from './QueueScreen';

const b = block('online-battle');

/** The public address of an invite, also inside the native shell (its own origin is localhost). */
export function duelShareUrl(code: string): string {
	return getApiBase() + challengePath(code);
}

/** "14:32" from milliseconds left. */
export function formatCountdown(ms: number): string {
	const s = Math.max(0, Math.ceil(ms / 1000));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The address without its scheme, for the eye: zktimer.app/duel/abc... */
function shortUrl(url: string): string {
	return url.replace(/^https?:\/\//, '');
}

interface Props {
	/** Null while the server opens the invite. */
	challenge: ChallengeStatePayload | null;
	myName: string;
	cube: QueueCubeView;
	toLocal(serverMs: number): number;
	onCancel(): void;
	onNewInvite(): void;
	onBack(): void;
}

/**
 * The inviter's screen while a duel invite is open (owner decision 2026-10-20): the link to
 * send, the time it has left and the cube that has to stay connected. The duel starts the
 * moment someone accepts (battle:matched takes the page to the match). When the invite ends
 * unused, the screen says so and offers a new one.
 *
 * Same surface and type as the queue's search panel, one column at every width: there is
 * one thing to do here.
 */
export default function DuelWaitScreen({challenge, myName, cube, toLocal, onCancel, onNewInvite, onBack}: Props) {
	const {t} = useTranslation();
	const [now, setNow] = useState(() => Date.now());
	const [copied, setCopied] = useState(false);

	const pending = !challenge || challenge.status === 'PENDING';
	useEffect(() => {
		if (!pending) return;
		const id = setInterval(() => setNow(Date.now()), 500);
		return () => clearInterval(id);
	}, [pending]);

	useEffect(() => {
		if (!copied) return;
		const id = setTimeout(() => setCopied(false), 2000);
		return () => clearTimeout(id);
	}, [copied]);

	const url = challenge ? duelShareUrl(challenge.code) : '';
	const canShare = isNative() || (typeof navigator !== 'undefined' && !!navigator.share);
	const target = challenge?.to?.username || null;

	const copy = async () => {
		if (await copyText(url)) setCopied(true);
		else toastError(url);
	};
	const share = async () => {
		const text = t('online_battle.duel.share_text', {name: myName});
		if (!(await shareContent({title: t('online_battle.duel.page_title'), text, url}))) await copy();
	};

	let title: string;
	let sub: string | null = null;
	if (!challenge) {
		title = t('online_battle.duel.creating');
	} else if (challenge.status === 'EXPIRED') {
		title = t('online_battle.duel.expired_title');
		sub = t('online_battle.duel.ended_sub');
	} else if (challenge.status === 'CANCELLED') {
		title = t('online_battle.duel.cancelled_title');
		sub = t('online_battle.duel.ended_sub');
	} else if (target) {
		title = t('online_battle.duel.waiting_for', {name: target});
		sub = t('online_battle.duel.waiting_sub_target', {name: target});
	} else {
		title = t('online_battle.duel.waiting_title');
		sub = t('online_battle.duel.waiting_sub_link');
	}

	const live = !!challenge && challenge.status === 'PENDING';
	const left = live ? toLocal(challenge.expiresAt) - now : 0;

	return (
		<div className={b('duel')}>
			<section className={b('duel-panel')} aria-live="polite">
				<span className={b('eyebrow')}>
					<span className={b('sticker', {blue: true})} aria-hidden="true" />
					{t('online_battle.duel.eyebrow')}
				</span>
				<h2 className={b('stage-title')}>{title}</h2>
				{live && (
					<div className={b('duel-clock')}>
						<span className={b('eyebrow')}>{t('online_battle.duel.time_left')}</span>
						<span className={b('stage-clock')} lang="en">
							{formatCountdown(left)}
						</span>
					</div>
				)}
				{sub && <p className={b('stage-sub')}>{sub}</p>}

				{live && (
					<div className={b('duel-link')}>
						<span className={b('eyebrow')}>{t('online_battle.duel.link_label')}</span>
						<div className={b('duel-link-row')}>
							<span className={b('duel-link-text')} lang="en">
								{shortUrl(url)}
							</span>
							<Button
								small
								gray
								iconFirst
								icon={copied ? <Check weight="bold" /> : <Copy weight="bold" />}
								text={copied ? t('online_battle.duel.copied') : t('online_battle.duel.copy')}
								onClick={copy}
							/>
						</div>
						{canShare && (
							<Button
								large
								fullWidth
								primary
								iconFirst
								icon={<ShareNetwork weight="bold" />}
								text={t('online_battle.duel.share')}
								onClick={share}
							/>
						)}
					</div>
				)}

				{cube.connected && (
					<div className={b('cube-row')}>
						<span className={b('sticker', {green: !!cube.info?.hasClock, orange: !cube.info?.hasClock})} aria-hidden="true" />
						<span className={b('cube-name')}>{cube.deviceName || t('online_battle.cube')}</span>
						{cube.battery != null && (
							<span className={b('cube-battery')} lang="en">
								{cube.battery}%
							</span>
						)}
					</div>
				)}

				<div className={b('duel-actions')}>
					{pending ? (
						<Button large fullWidth gray text={t('online_battle.duel.cancel_invite')} onClick={onCancel} />
					) : (
						<>
							<Button large fullWidth primary text={t('online_battle.duel.new_invite')} onClick={onNewInvite} />
							<Button large fullWidth gray text={t('online_battle.back')} onClick={onBack} />
						</>
					)}
				</div>
			</section>
			<p className={b('duel-rules')}>{t('online_battle.duel.rules', {n: ROUNDS_TO_WIN})}</p>
		</div>
	);
}
