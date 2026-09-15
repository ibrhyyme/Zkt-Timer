import confetti from 'canvas-confetti';
import { useEventListener } from '../../../util/event_handler';
import { ITimerContext } from '../Timer';
import { getSinglePB } from '../../../db/solves/stats/solves/single/single_pb';
import { getAveragePB } from '../../../db/solves/stats/solves/average/average_pb';
import { FilterSolvesOptions } from '../../../db/solves/query';
import { displayTimerAlert } from './notification';
import { getCubeTypeInfoById } from '../../../util/cubes/util';
import { getSetting } from '../../../db/settings/query';
import { hapticNotification, requestInAppReview } from '../../../util/native-plugins';

let lastConfetti: Date = null;

// Called on every Timer render, so it is a hook in all but name: the listeners below
// must be registered on every call, which is why `ignorePbEvents` is checked inside
// them instead of returning early before them.
export function listenForPbEvents(context: ITimerContext) {
	const ignore = !!context.ignorePbEvents;

	// In case the user doesn't have Quick Stats selected, we need to fetch the single and average PB so that it can be
	// find in the cache
	//
	// Deliberately on every render rather than memoized: checkForPB only compares against
	// cached entries, and saving a solve drops the avg_pb entry (and the single_pb one on
	// a new PB), so the warm-up has to run again after each save. When the entry is
	// still cached these two calls are cache lookups.
	if (!ignore) {
		const pbFilter: FilterSolvesOptions = {
			cube_type: context.cubeType,
			scramble_subset: context.scrambleSubset ?? null,
			from_timer: true,
		};

		getSinglePB(pbFilter);
		getAveragePB(pbFilter, 5);
	}

	function getPbDisplayName(cubeType: string, scrambleSubset: string | null): string {
		const displayId = (cubeType === 'wca' && scrambleSubset) ? scrambleSubset : cubeType;
		return getCubeTypeInfoById(displayId)?.name || displayId;
	}

	function pbEventCallback(msg: string, cubeTypeName: string) {
		triggerConfetti();
		hapticNotification('success');
		displayTimerAlert({
			text: msg,
			backgroundColor: 'green',
		});
		// PB mutlu an — kullanicidan degerlendirme iste (session basina 1 kez)
		setTimeout(() => requestInAppReview(), 3000);
	}

	useEventListener(
		'singlePbEvent',
		({ cubeType: ct, scrambleSubset }) => {
			if (ignore) return;
			const name = getPbDisplayName(ct, scrambleSubset);
			pbEventCallback(`Yeni ${name} Single PB!`, name);
		},
		[context.cubeType]
	);

	useEventListener(
		'avgPbEvent',
		({ cubeType: ct, scrambleSubset }) => {
			if (ignore) return;
			const name = getPbDisplayName(ct, scrambleSubset);
			pbEventCallback(`Yeni ${name} Average of 5 PB!`, name);
		},
		[context.cubeType]
	);

	useEventListener(
		'singleAndAvgPbEvent',
		({ cubeType: ct, scrambleSubset }) => {
			if (ignore) return;
			const name = getPbDisplayName(ct, scrambleSubset);
			pbEventCallback(`Yeni ${name} Single ve Average of 5 PB!`, name);
		},
		[context.cubeType]
	);
}

export function triggerConfetti() {
	const pbConfetti = getSetting('pb_confetti');
	if (!pbConfetti) {
		return;
	}

	const duration = 1000;
	if (lastConfetti && new Date().getTime() - lastConfetti.getTime() < duration / 2) {
		return;
	}

	lastConfetti = new Date();
	const defaults = { startVelocity: 40, spread: 190, ticks: 50, zIndex: 10000, particleCount: 50 };

	function randomInRange(min, max) {
		return Math.random() * (max - min) + min;
	}

	confetti({
		...defaults,
		origin: { x: randomInRange(0.1, 0.3), y: randomInRange(0.1, 0.3) },
	});
	confetti({
		...defaults,
		origin: { x: randomInRange(0.3, 0.7), y: randomInRange(0.3, 0.7) },
	});
	confetti({
		...defaults,
		origin: { x: randomInRange(0.7, 0.9), y: randomInRange(0.7, 0.9) },
	});
}
