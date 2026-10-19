/**
 * Sharing a set's link (trainer-sets 7.4, 7.5).
 *
 * Phone (native app, or a mobile browser with the Web Share API): the system share sheet with
 * "<name>: <n> algorithms. Practice it on Zkt Timer." and the link. Desktop: the link goes to
 * the clipboard and a toast says so. The link is always the public site address
 * (`getApiBase()`), also inside the native shell whose own origin is capacitor://localhost.
 *
 * Who gets the button is the set page's rule: the owner always (a private set first offers to
 * open sharing), others only on a public set.
 */
import React from 'react';
import {useTranslation} from 'react-i18next';
import {ShareNetwork} from 'phosphor-react';
import Button from '../../common/button/Button';
import {getApiBase} from '../../../util/api-base';
import {isNative} from '../../../util/platform';
import {shareContent} from '../../../util/native-plugins';
import {toastError, toastSuccess} from '../../../util/toast';
import {copyText} from '../../../util/clipboard';
import {useGeneral} from '../../../util/hooks/useGeneral';
import {buildSetPath} from '../../../util/trainer/url/trainer_url';

export function algSetShareUrl(code: string): string {
	return getApiBase() + buildSetPath(code);
}

/** Returns `share(set)`: native share sheet on phones, clipboard on desktop. */
export function useShareAlgSet() {
	const {t} = useTranslation();
	const mobileMode = useGeneral('mobile_mode');

	return async function share(set: {code: string; name: string; item_count: number}) {
		const url = algSetShareUrl(set.code);
		const text = t('trainer.sets.share_text', {name: set.name, count: set.item_count});
		const canSheet = isNative() || (mobileMode && typeof navigator !== 'undefined' && !!navigator.share);
		if (canSheet && (await shareContent({title: set.name, text, url}))) return;
		if (await copyText(url)) toastSuccess(t('trainer.sets.link_copied'));
		else toastError(url);
	};
}

interface Props {
	set: {code: string; name: string; item_count: number};
	disabled?: boolean;
	/** Replaces sharing (a private set: offer to open sharing first). */
	onBlocked?: () => void;
}

export default function ShareButton({set, disabled, onBlocked}: Props) {
	const {t} = useTranslation();
	const share = useShareAlgSet();
	return (
		<Button
			gray
			icon={<ShareNetwork weight="bold" />}
			iconFirst
			text={t('trainer.sets.share')}
			disabled={disabled}
			onClick={() => (onBlocked ? onBlocked() : share(set))}
		/>
	);
}
