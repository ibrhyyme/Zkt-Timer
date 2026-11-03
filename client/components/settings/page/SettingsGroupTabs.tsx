// Jumps between the groups of the open section (Theme, Layout, Fonts...). Long sections
// run several screens, and the group names in the rows are the only map of them.
//
// The groups are read from the page rather than listed here: each section renders its
// own, and a group hides itself when a setting makes it irrelevant (the Virtual Cube rows
// in Input), so a list kept here would drift. TimerSettingsGroup marks them.

import React, {RefObject, useEffect, useMemo, useState} from 'react';
import TabBar from '../../common/tab_bar/TabBar';
import {useScrollSpy} from '../../../util/hooks/useScrollSpy';

interface Group {
	id: string;
	label: string;
}

interface Props {
	contentRef: RefObject<HTMLElement>;
	/** Names the bar for a screen reader. */
	label: string;
}

function readGroups(content: HTMLElement): Group[] {
	const nodes = Array.from(content.querySelectorAll<HTMLElement>('[data-settings-group]'));
	return nodes.map((node, index) => {
		// Half the groups have no id of their own, and the scroll spy and the jump need one.
		if (!node.id) node.id = `settings-group-${index}`;
		return {id: node.id, label: node.dataset.settingsLabel || ''};
	});
}

function sameGroups(a: Group[], b: Group[]): boolean {
	return a.length === b.length && a.every((group, i) => group.id === b[i].id && group.label === b[i].label);
}

export default function SettingsGroupTabs({contentRef, label}: Props) {
	const [groups, setGroups] = useState<Group[]>([]);

	useEffect(() => {
		const content = contentRef.current;
		if (!content) return undefined;

		let frame = 0;
		const read = () => {
			frame = 0;
			const next = readGroups(content);
			setGroups((previous) => (sameGroups(previous, next) ? previous : next));
		};

		read();
		const observer = new MutationObserver(() => {
			if (!frame) frame = requestAnimationFrame(read);
		});
		observer.observe(content, {childList: true, subtree: true});

		return () => {
			observer.disconnect();
			if (frame) cancelAnimationFrame(frame);
		};
	}, [contentRef]);

	const sectionIds = useMemo(() => groups.map((group) => group.id), [groups]);
	const spied = useScrollSpy({
		sectionIds,
		scrollContainerRef: contentRef,
		rootMargin: '-72px 0px -65% 0px',
		pick: 'last',
	});

	// A section with one group has nothing to jump to.
	if (groups.length < 2) return null;

	// The spy keeps its last answer across a route change, until the new groups scroll by.
	const value = sectionIds.includes(spied) ? spied : sectionIds[0];

	return (
		<TabBar
			label={label}
			tabs={groups}
			value={value}
			onChange={(id) => document.getElementById(id)?.scrollIntoView({behavior: 'smooth', block: 'start'})}
		/>
	);
}
