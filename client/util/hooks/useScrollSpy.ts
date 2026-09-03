import {useState, useEffect, useRef, RefObject} from 'react';

interface ScrollSpyOptions {
	sectionIds: string[];
	// Omit for a page that scrolls with the document (the help page); pass a ref
	// when the sections live inside their own scrolling box (the settings modal).
	scrollContainerRef?: RefObject<HTMLElement>;
	// Which slice of the viewport counts as "you are here". The default keeps the
	// whole upper 40%, which suits the short groups in the settings modal. Long-form
	// pages want a narrow band instead: with a wide one the tail of the previous
	// section is still inside it, and since the first match in `sectionIds` wins, the
	// nav lags a full section behind.
	rootMargin?: string;
	// Which section wins when several are inside the band at once. 'first' (default)
	// suits short groups. Long sections need 'last': scrolling one to the top leaves
	// the tail of the previous section in the band too, and 'first' would keep
	// reporting the section you just left.
	pick?: 'first' | 'last';
}

export function useScrollSpy({sectionIds, scrollContainerRef, rootMargin, pick}: ScrollSpyOptions): string {
	const [activeId, setActiveId] = useState(sectionIds[0] || '');
	const visibleSetRef = useRef<Set<string>>(new Set());

	useEffect(() => {
		const container = scrollContainerRef?.current ?? null;
		// A caller that asked for a container but whose ref has not attached yet must
		// wait, not silently fall back to observing the whole document.
		if (scrollContainerRef && !container) return;
		if (sectionIds.length === 0) return;

		const scope: ParentNode = container ?? document;

		visibleSetRef.current.clear();

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const id = entry.target.id;
					if (entry.isIntersecting) {
						visibleSetRef.current.add(id);
					} else {
						visibleSetRef.current.delete(id);
					}
				}

				// sectionIds sirasina gore ilk (veya son) gorunur olani bul
				const ordered = pick === 'last' ? [...sectionIds].reverse() : sectionIds;
				const match = ordered.find((id) => visibleSetRef.current.has(id));
				if (match) {
					setActiveId(match);
				}
			},
			{
				// null root means the viewport, which is what document scrolling needs.
				root: container,
				rootMargin: rootMargin ?? '0px 0px -60% 0px',
				threshold: 0,
			}
		);

		sectionIds.forEach((id) => {
			const el = scope.querySelector(`#${id}`);
			if (el) observer.observe(el);
		});

		return () => observer.disconnect();
	}, [sectionIds, scrollContainerRef, rootMargin, pick]);

	return activeId;
}
