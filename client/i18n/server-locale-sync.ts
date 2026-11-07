import i18n from './i18n';
import { gqlMutateTyped, gqlQueryTyped } from '../components/api';
import { SettingsLocaleDocument, UpdateLocaleDocument } from '../@types/generated/graphql';
import { FALLBACK_LANGUAGE, matchSupportedLanguage } from '../../shared/i18n_language';

/**
 * Keeps the server's `settings.locale` equal to the language the app is showing.
 *
 * Every push, in-app and email notification is written in `settings.locale`, but the
 * app picks its language on the device: the user's choice, a ?lang= link, the SSR
 * cookie, or (first native launch) the phone's language. Only the language pickers
 * used to write it back, so a user whose app followed the phone into Spanish kept
 * getting notifications in whatever language the account was created with.
 *
 * Runs while a user is logged in: once at login/boot and again on every language
 * change, from any source. The server value is read once per user and cached, so a
 * normal launch costs one small query and no write. Calls are chained so a quick
 * series of changes cannot land out of order; each step reads the language at the
 * moment it runs, so the last one always wins.
 */

let activeUserId: string | null = null;
let serverLocale: string | null = null;
let chain: Promise<void> = Promise.resolve();

function appLanguage(): string {
	return matchSupportedLanguage(i18n.language) || FALLBACK_LANGUAGE;
}

async function reconcile(userId: string): Promise<void> {
	if (activeUserId !== userId) return;

	if (serverLocale === null) {
		const res = await gqlQueryTyped(SettingsLocaleDocument, {}, { fetchPolicy: 'no-cache' });
		if (activeUserId !== userId) return;
		serverLocale = res.data?.settings?.locale ?? '';
	}

	const wanted = appLanguage();
	if (serverLocale === wanted) return;

	await gqlMutateTyped(UpdateLocaleDocument, { locale: wanted });
	if (activeUserId === userId) serverLocale = wanted;
}

function schedule(): void {
	const userId = activeUserId;
	if (!userId) return;
	chain = chain
		.then(() => reconcile(userId))
		.catch(() => {
			// Best effort: offline or a failed request. Forget the cached value so the
			// next language change or login reads the server again.
			serverLocale = null;
		});
}

function onLanguageChanged(): void {
	schedule();
}

export function startServerLocaleSync(userId: string): void {
	if (typeof window === 'undefined') return;
	if (activeUserId !== userId) serverLocale = null;
	if (!activeUserId) i18n.on('languageChanged', onLanguageChanged);
	activeUserId = userId;
	schedule();
}

export function stopServerLocaleSync(): void {
	if (!activeUserId) return;
	i18n.off('languageChanged', onLanguageChanged);
	activeUserId = null;
	serverLocale = null;
}
