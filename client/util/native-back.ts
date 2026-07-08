import type { PluginListenerHandle } from '@capacitor/core';

/**
 * Tracks the App plugin's backButton listener so external navigations can drop it.
 *
 * Capacitor's native behavior (AppPlugin.java): when NO backButton listener is
 * registered, a hardware back press falls through to webView.goBack(); when one
 * IS registered, the event is delivered to the page's JS instead. Once the
 * WebView navigates to an external site (e.g. a WCA profile, allowed via
 * allowNavigation), the app's JS is gone but the listener registration survives
 * on the native side, so every back press is swallowed and the user is trapped.
 * Releasing the listener right before leaving re-enables the native goBack()
 * fallback; navigating back reloads the app page, which re-registers it.
 */

let backButtonHandle: PluginListenerHandle | null = null;

export function setBackButtonHandle(handle: PluginListenerHandle): void {
	backButtonHandle = handle;
}

export async function releaseNativeBackButton(): Promise<void> {
	const handle = backButtonHandle;
	backButtonHandle = null;
	if (!handle) return;
	try {
		await handle.remove();
	} catch (e) {
		// Bridge call failed; worst case the previous behavior remains.
	}
}
