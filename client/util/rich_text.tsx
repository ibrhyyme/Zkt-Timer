import React, { ReactNode } from 'react';
import { openInAppBrowser } from './external-link';

/**
 * Renders plain announcement/notification text with clickable links.
 *
 * Supported syntax:
 *   - Markdown named links: [label](https://example.com) or [label](/internal/path)
 *   - Bare http(s) URLs: https://example.com  (auto-linkified)
 *
 * Safety: only http(s) and internal `/` paths become links. The markdown URL group
 * only matches `https?://` or `/...`, so schemes like `javascript:` never match and
 * stay as plain text. External links open via openInAppBrowser (system browser on
 * native, new tab on web); internal links navigate in-app.
 */

// [label](url) OR bare http(s) URL. Markdown url group accepts http(s) or internal "/...".
const LINK_RE = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;

function isSafeUrl(url: string): boolean {
	return /^https?:\/\//i.test(url) || url.startsWith('/');
}

function handleClick(e: React.MouseEvent, url: string) {
	e.preventDefault();
	e.stopPropagation();
	if (/^https?:\/\//i.test(url)) {
		openInAppBrowser(url);
	} else if (url.startsWith('/')) {
		window.location.href = url;
	}
}

function linkEl(label: string, url: string, key: number): ReactNode {
	return (
		<a
			key={`rtl-${key}`}
			href={url}
			onClick={(e) => handleClick(e, url)}
			style={{
				color: 'rgb(var(--primary-color))',
				textDecoration: 'underline',
				cursor: 'pointer',
				wordBreak: 'break-word',
			}}
		>
			{label}
		</a>
	);
}

export function renderRichText(content: string): ReactNode {
	if (!content) return content;

	const nodes: ReactNode[] = [];
	let lastIndex = 0;
	let key = 0;
	let match: RegExpExecArray | null;

	LINK_RE.lastIndex = 0;
	while ((match = LINK_RE.exec(content)) !== null) {
		const [full, mdLabel, mdUrl, bareUrl] = match;
		const start = match.index;

		// Preceding plain text (whitespace/newlines preserved by parent's pre-wrap)
		if (start > lastIndex) {
			nodes.push(content.slice(lastIndex, start));
		}

		if (mdUrl) {
			// Named markdown link
			nodes.push(isSafeUrl(mdUrl) ? linkEl(mdLabel, mdUrl, key++) : full);
		} else {
			// Bare http(s) URL — strip trailing sentence punctuation back into the text
			const stripped = bareUrl.replace(/[.,!?;:]+$/, '');
			nodes.push(linkEl(stripped, stripped, key++));
			const tail = bareUrl.slice(stripped.length);
			if (tail) nodes.push(tail);
		}

		lastIndex = start + full.length;
	}

	if (lastIndex < content.length) {
		nodes.push(content.slice(lastIndex));
	}

	return nodes;
}
