import React from 'react';
import AnonBanner from '../anon/AnonBanner';
import AppBanner, {useAndroidAppBanner} from './AppBanner';

// The one strip slot: the Play app strip on an Android browser, otherwise the signed-out
// strip (a no-op for signed-in users). Wrapper renders it above every page except the
// phone timer, whose fixed full-screen layer would cover it; the timer renders it inside
// its own layout instead (Timer.tsx, `mobile-banner`).
export default function BannerSlot() {
	const appBanner = useAndroidAppBanner();
	return appBanner.visible ? <AppBanner onDismiss={appBanner.dismiss} /> : <AnonBanner />;
}
