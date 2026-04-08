import React from 'react';
import {useTranslation} from 'react-i18next';
import {useSiteConfig, SiteConfigData} from '../../../util/hooks/useSiteConfig';
import {useMe} from '../../../util/hooks/useMe';
import PageDisabled from './PageDisabled';
import AdminDisabledBanner from './AdminDisabledBanner';

type FeatureKey = 'trainer_enabled' | 'community_enabled' | 'leaderboards_enabled' | 'rooms_enabled' | 'battle_enabled';

interface Props {
	feature: FeatureKey;
	pageNameKey: string; // i18n key (orn 'nav.trainer')
	children: React.ReactNode;
}

/**
 * Sayfa-bazinda feature flag guard'i.
 * - Feature kapali + admin degilse → PageDisabled goster
 * - Feature kapali + admin → AdminDisabledBanner + cocuklar render
 * - Feature acik → cocuklar render
 */
export default function FeatureGuard({feature, pageNameKey, children}: Props) {
	const {t} = useTranslation();
	const config = useSiteConfig();
	const me = useMe();
	const isAdmin = !!me?.admin;
	const pageName = t(pageNameKey);

	// Loading sirasinda cocuklari render et (cache yoksa)
	if (!config) {
		return <>{children}</>;
	}

	const enabled = (config as any)[feature];

	if (!enabled && !isAdmin) {
		return <PageDisabled pageName={pageName} />;
	}

	if (!enabled && isAdmin) {
		return (
			<>
				<AdminDisabledBanner pageName={pageName} />
				{children}
			</>
		);
	}

	return <>{children}</>;
}
