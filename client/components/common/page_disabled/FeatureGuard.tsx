import React from 'react';
import {useTranslation} from 'react-i18next';
import {useSiteConfig} from '../../../util/hooks/useSiteConfig';
import {useMe} from '../../../util/hooks/useMe';
import PageDisabled from './PageDisabled';
import AdminDisabledBanner from './AdminDisabledBanner';

type FeatureKey = 'trainer_enabled' | 'community_enabled' | 'leaderboards_enabled' | 'rooms_enabled' | 'battle_enabled' | 'pro_enabled';

interface Props {
	feature: FeatureKey;
	pageNameKey: string; // i18n key (orn 'nav.trainer')
	children: React.ReactNode;
}

/**
 * Sayfa-bazinda feature flag guard'i.
 * - Admin: her zaman icerik goster (kapaliysa AdminDisabledBanner ekle)
 * - EXCLUDE override && kullanici listede: PageDisabled
 * - Feature acik: icerik goster
 * - INCLUDE override && kullanici listede: icerik goster
 * - Diger: PageDisabled
 */
export default function FeatureGuard({feature, pageNameKey, children}: Props) {
	const {t} = useTranslation();
	const config = useSiteConfig();
	const me = useMe();
	const isAdmin = !!me?.admin;
	const pageName = t(pageNameKey);

	// Config henuz yuklenmediyse icerik gosterme (SSR + ilk client render)
	if (!config) {
		return null;
	}

	const enabled = (config as any)[feature];
	const override = config.featureOverrides?.find((o) => o.feature === feature);
	const userId = me?.id;

	// Admin her zaman gorer
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

	// Feature acik — herkes gorer
	if (enabled) {
		return <>{children}</>;
	}

	// Feature kapali — ozel erisim listesinde var mi?
	if (userId && override?.users?.some((u) => u?.id === userId)) {
		return <>{children}</>;
	}

	return <PageDisabled pageName={pageName} />;
}
