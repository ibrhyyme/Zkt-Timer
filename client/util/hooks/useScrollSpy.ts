import {useState, useEffect, useRef, RefObject} from 'react';

interface ScrollSpyOptions {
	sectionIds: string[];
	scrollContainerRef: RefObject<HTMLElement>;
}

export function useScrollSpy({sectionIds, scrollContainerRef}: ScrollSpyOptions): string {
	const [activeId, setActiveId] = useState(sectionIds[0] || '');
	const visibleSetRef = useRef<Set<string>>(new Set());

	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container || sectionIds.length === 0) return;

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

				// sectionIds sirasina gore ilk gorunur olani bul
				const firstVisible = sectionIds.find((id) => visibleSetRef.current.has(id));
				if (firstVisible) {
					setActiveId(firstVisible);
				}
			},
			{
				root: container,
				rootMargin: '0px 0px -60% 0px',
				threshold: 0,
			}
		);

		sectionIds.forEach((id) => {
			const el = container.querySelector(`#${id}`);
			if (el) observer.observe(el);
		});

		return () => observer.disconnect();
	}, [sectionIds, scrollContainerRef]);

	return activeId;
}
