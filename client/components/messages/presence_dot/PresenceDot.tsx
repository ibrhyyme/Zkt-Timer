import React from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../styles/bem';
import './PresenceDot.scss';

const b = block('presence-dot');

interface Props {
	online: boolean;
	/** Bubble avatars and inbox rows carry a smaller dot than a conversation header. */
	small?: boolean;
}

/**
 * The green dot, and nothing more.
 *
 * There is no "last seen 5 minutes ago" variant of this component and there should
 * never be one. Online is a fact about right now that stops existing when the socket
 * closes; a timestamp is a record of someone's day that we would then be holding.
 *
 * Renders nothing when offline rather than a grey dot: an explicit "not here" invites
 * exactly the watching this feature is trying not to encourage.
 */
export default function PresenceDot({online, small}: Props) {
	const {t} = useTranslation();

	if (!online) return null;

	return <span className={b({small})} title={t('social.online')} aria-label={t('social.online')} />;
}
