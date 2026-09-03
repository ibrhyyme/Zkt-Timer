// Shown in place of a page that genuinely needs an account.
//
// The alternative — bouncing straight to /login — tells the visitor nothing about
// what they were reaching for, and reads as a wall. Here the page still opens and
// states what it is and why it needs an account.
//
// Same visual treatment as the Pro gate, on purpose: one "you cannot use this yet"
// language across the product rather than two that drift apart.

import React from 'react';
import {useTranslation} from 'react-i18next';
import {UserCirclePlus} from 'phosphor-react';
import ProBlurOverlay from '../pro_blur_overlay/ProBlurOverlay';

interface Props {
	/** i18n key for the sentence explaining what this particular page offers. */
	descriptionKey: string;
	minHeight?: number;
}

export default function AccountRequired({descriptionKey, minHeight}: Props) {
	const {t} = useTranslation();

	return (
		<ProBlurOverlay
			icon={<UserCirclePlus weight="fill" />}
			eyebrow={t('account_required.eyebrow')}
			title={t('account_required.title')}
			description={t(descriptionKey)}
			ctaLabel={t('account_required.cta')}
			ctaTo="/signup"
			minHeight={minHeight || 420}
		/>
	);
}
