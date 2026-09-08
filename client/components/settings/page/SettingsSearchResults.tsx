// Search view: every section at once, filtered down to the matching groups.
//
// The filter lives in TimerSettingsGroup and reads the props of its own children, so
// a group can only match while it is mounted. Sections are on separate routes now, so
// searching mounts all of them here rather than routing anywhere. The moment the box
// is cleared the page goes back to showing just the current section.

import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {SettingsSearchProvider} from '../SettingsSearchContext';
import TimerSettings from '../timer/TimerSettings';
import InputSettings from '../input/InputSettings';
import SmartCubeSettings from '../smart_cube/SmartCubeSettings';
import ScrambleSettings from '../scramble/ScrambleSettings';
import Appearance from '../appearance/Appearance';
import DataSettings from '../data/DataSettings';
import LanguageSettings from '../language/LanguageSettings';

interface Props {
	query: string;
}

export default function SettingsSearchResults(props: Props) {
	const {query} = props;
	const {t} = useTranslation();
	const containerRef = useRef<HTMLDivElement>(null);
	const [noResults, setNoResults] = useState(false);

	// After a query change the content re-renders with only matching groups in the
	// DOM; count what survived to drive the "no results" message.
	useEffect(() => {
		const raf = requestAnimationFrame(() => {
			const container = containerRef.current;
			if (container) {
				setNoResults(container.querySelectorAll('[data-settings-group]').length === 0);
			}
		});
		return () => cancelAnimationFrame(raf);
	}, [query]);

	return (
		<SettingsSearchProvider value={{query}}>
			<div ref={containerRef} className="space-y-2">
				<TimerSettings />
				<InputSettings />
				<SmartCubeSettings />
				<ScrambleSettings />
				<Appearance />
				<DataSettings />
				<LanguageSettings />
			</div>
			{noResults ? (
				<div className="py-12 text-center text-text">{t('settings.search_no_results')}</div>
			) : null}
		</SettingsSearchProvider>
	);
}
