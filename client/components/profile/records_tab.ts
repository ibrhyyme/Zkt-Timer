// Which records tab a profile shows. Pure, so the rule is unit-tested.

export type RecordsTab = 'pb' | 'wca' | 'zkt' | 'results' | 'zkt_results';

/**
 * The tab the viewer picked while it still exists, else the first tab that
 * does, in the order the tab bar draws them.
 *
 * The default used to be chosen once, inside the WCA loader, and never looked
 * at ZKT: a member with ZKT results but no Zkt Timer PBs and no WCA records got
 * a tab bar with nothing selected and an empty panel under it. Deriving the tab
 * from what is available also survives the loaders finishing in any order.
 */
export function pickRecordsTab(selected: RecordsTab | null, available: RecordsTab[]): RecordsTab | null {
	if (selected && available.includes(selected)) {
		return selected;
	}
	return available[0] ?? null;
}
