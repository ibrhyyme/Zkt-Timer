import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {PlayCircle} from 'phosphor-react';
import block from '../../../styles/bem';
import {openInAppBrowser} from '../../../util/external-link';
import {firstYoutubeVideo, parseMessageBody, youtubeThumbnail} from '../../../util/message-links';
import './MessageBody.scss';

const b = block('message-body');

interface Props {
	body: string;
	/** Bubble windows are narrow, so the cover image is scaled down there. */
	compact?: boolean;
	/**
	 * False in a request the reader has not accepted yet. The text is shown in full,
	 * but nothing in it is clickable and no cover image is fetched.
	 *
	 * A message request is the one place a complete stranger can put words in front of
	 * someone, which makes it the natural home for a phishing link. Requiring one
	 * deliberate "accept" before an address becomes a button costs a real conversation
	 * nothing and costs a spammer their whole reason for sending it.
	 */
	trusted?: boolean;
}

/**
 * A message's text, with addresses turned into links.
 *
 * Shared by the full thread and the floating bubble window on purpose: a link that
 * works in one and not the other is the kind of difference nobody reports and
 * everybody notices.
 *
 * The body is still rendered as text nodes. Nothing here builds HTML from user input,
 * so a message containing markup shows up as the characters that were typed.
 */
export default function MessageBody({body, compact, trusted = true}: Props) {
	const {t} = useTranslation();
	const [coverFailed, setCoverFailed] = useState(false);

	const segments = parseMessageBody(body);
	const video = trusted ? firstYoutubeVideo(segments) : null;

	function open(e: React.MouseEvent, href: string) {
		// Handled here rather than by the browser so the native app opens a real
		// in-app browser instead of navigating the WebView, which strands the user
		// with no way back into the app.
		e.preventDefault();
		e.stopPropagation();
		openInAppBrowser(href);
	}

	return (
		<div className={b()}>
			<div className={b('text')}>
				{segments.map((segment, i) =>
					segment.type === 'text' || !trusted ? (
						// An untrusted address stays visible as the characters that were
						// typed, so the reader can still judge it, copy it, or report it.
						<React.Fragment key={i}>{segment.type === 'text' ? segment.value : segment.label}</React.Fragment>
					) : (
						<a
							key={i}
							className={b('link')}
							href={segment.href}
							target="_blank"
							// noopener/noreferrer: the opened page must not get a handle on
							// this tab. nofollow: a DM is not an endorsement, and without it
							// the inbox becomes worth spamming for search ranking.
							rel="noopener noreferrer nofollow"
							onClick={(e) => open(e, segment.href)}
						>
							{segment.label}
						</a>
					)
				)}
			</div>

			{/* A cover only appears once we know there is one. A deleted or private video
			    answers 404 and the card disappears rather than showing a broken frame. */}
			{video && !coverFailed && (
				<a
					className={b('video', {compact})}
					href={video.href}
					target="_blank"
					rel="noopener noreferrer nofollow"
					onClick={(e) => open(e, video.href)}
					title={t('messages.watch_on_youtube')}
				>
					<img
						className={b('video-cover')}
						src={youtubeThumbnail(video.id)}
						alt=""
						loading="lazy"
						onError={() => setCoverFailed(true)}
					/>
					<span className={b('video-play')} aria-hidden="true">
						<PlayCircle weight="fill" />
					</span>
					<span className={b('video-source')}>{t('messages.watch_on_youtube')}</span>
				</a>
			)}
		</div>
	);
}
