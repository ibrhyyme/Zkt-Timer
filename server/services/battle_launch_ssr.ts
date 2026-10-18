import type {Store} from 'redux';
import {getSiteConfig} from '../models/site_config';
import {logger} from './logger';
import {setSsrValue} from '../../client/actions/ssr';
import {BATTLE_LAUNCH_SSR_KEY, BattleLaunchUser, battleLaunchFromConfig} from '../../client/components/battle/battle_landing_modes';

/**
 * Seeds the Online Battle launch decision into the SSR store (ranking-battle 7.1 step 7, 7.4).
 *
 * The menu's Sıralama entry, the /ranks noindex tag, the /battle landing and the help and
 * landing copy all hang off `online_battle_enabled`. A crawler only reads the first HTML,
 * and the client must hydrate the same markup, so the server decides once per page and the
 * client reads it back (client/components/battle/useBattleLaunch.ts).
 *
 * getSiteConfig is Redis cached (30 s). A failure leaves the value unset: the client then
 * treats the flag as unknown, which keeps /ranks out of the index and the entry hidden.
 */
export async function seedBattleLaunch(store: Store<any>, me: BattleLaunchUser | null | undefined): Promise<void> {
	try {
		const config = await getSiteConfig();
		store.dispatch(setSsrValue(BATTLE_LAUNCH_SSR_KEY, battleLaunchFromConfig(config, me)));
	} catch (e) {
		logger.warn('SSR battle launch seed failed', {error: (e as Error)?.message || e});
	}
}
