import {useEffect, useState} from 'react';
import {RootStateOrAny, useSelector} from 'react-redux';
import {useSiteConfig} from '../../util/hooks/useSiteConfig';
import {useMe} from '../../util/hooks/useMe';
import {BATTLE_LAUNCH_SSR_KEY, BattleLaunch, battleLaunchFromConfig, readSeededBattleLaunch} from './battle_landing_modes';

/**
 * The Online Battle launch decision (battle_landing_modes.ts) for this render.
 *
 * Server render and the first client render read the value the server seeded into the
 * `ssr` slice, so the menu, the noindex tag and the landing hydrate without a mismatch (the
 * client may hold a newer config snapshot in localStorage that the server never saw). After
 * mount the live, polled site config takes over. null = not known yet.
 */
export function useBattleLaunch(): BattleLaunch | null {
	const seeded = useSelector((state: RootStateOrAny) => state?.ssr?.[BATTLE_LAUNCH_SSR_KEY]);
	const config = useSiteConfig();
	const me = useMe();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (mounted && config) return battleLaunchFromConfig(config, me);
	return readSeededBattleLaunch(seeded);
}
