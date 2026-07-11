import React from 'react';
import {useTranslation} from 'react-i18next';
import {useSiteConfig} from '../../../util/hooks/useSiteConfig';
import {useMe} from '../../../util/hooks/useMe';
import PageDisabled from './PageDisabled';
import AdminDisabledBanner from './AdminDisabledBanner';

type FeatureKey = 'trainer_enabled' | 'community_enabled' | 'leaderboards_enabled' | 'rooms_enabled' | 'battle_enabled' | 'pro_enabled';

interface Props {
	feature: FeatureKey;
	pageNameKey: string; // i18n key (e.g. 'nav.trainer')
	children: React.ReactNode;
}

/**
 * Per-page feature flag guard.
 * - Admin: always show content (if disabled, add AdminDisabledBanner)
 * - EXCLUDE override && user in list: PageDisabled
 * - Feature enabled: show content
 * - INCLUDE override && user in list: show content
 * - Other: PageDisabled
 */
export default function FeatureGuard({feature, pageNameKey, children}: Props) {
	const {t} = useTranslation();
	const config = useSiteConfig();
	const me = useMe();
	const isAdmin = !!me?.admin;
	const pageName = t(pageNameKey);

	// Don't show content if config not yet loaded (SSR + first client render)
	if (!config) {
		// Offline with no cached config (fresh install, never fetched): fail open.
		// Blocking would blank every guarded page — battle/trainer are fully local.
		// The kill switches re-apply as soon as a config fetch succeeds again.
		if (typeof navigator !== 'undefined' && navigator.onLine === false) {
			return <>{children}</>;
		}
		return null;
	}

	const enabled = (config as any)[feature];
	const override = config.featureOverrides?.find((o) => o.feature === feature);
	const userId = me?.id;

	// Admin always sees content
	if (isAdmin) {
		if (!enabled) {
			return (
				<>
					<AdminDisabledBanner pageName={pageName} />
					{children}
				</>
			);
		}
		return <>{children}</>;
	}

	// Feature enabled — everyone sees content
	if (enabled) {
		return <>{children}</>;
	}

	// Feature disabled — is user in special access list?
	if (userId && override?.users?.some((u) => u?.id === userId)) {
		return <>{children}</>;
	}

	return <PageDisabled pageName={pageName} />;
}
