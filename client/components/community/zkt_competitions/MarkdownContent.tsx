import React, {useEffect, useState} from 'react';

/**
 * react-markdown v8 is pure ESM and cannot be require()'d during SSR
 * (ts-node-dev CommonJS → ERR_REQUIRE_ESM). Load it lazily on the client only;
 * SSR and the first client paint fall back to whitespace-preserving plain text,
 * then the rendered markdown swaps in after mount.
 */
export default function MarkdownContent({content}: {content: string}) {
	const [Markdown, setMarkdown] = useState<any>(null);

	useEffect(() => {
		let active = true;
		import('react-markdown')
			.then((m) => {
				if (active) setMarkdown(() => m.default);
			})
			.catch(() => {
				// Keep the plain-text fallback on load failure.
			});
		return () => {
			active = false;
		};
	}, []);

	if (!Markdown) {
		return <div style={{whiteSpace: 'pre-wrap'}}>{content}</div>;
	}
	return <Markdown>{content}</Markdown>;
}
