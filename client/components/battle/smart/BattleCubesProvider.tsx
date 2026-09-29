import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { SmartEngineEvent } from '../../../util/smart_cube';
import { isNative } from '../../../util/platform';
import { openModal, closeModal } from '../../../actions/general';
import { toastError } from '../../../util/toast';
import BleScanningModal from '../../timer/smart_cube/ble_scanning_modal/BleScanningModal';
import BluetoothErrorMessage from '../../timer/common/BluetoothErrorMessage';
import { SmartTurn } from '../../../util/smart_scramble';
import { getBleAdapter } from '../../../util/ble';
import { getSmartCubeManager } from '../../../util/smart_cube/connection_manager';
import { useSettings } from '../../../util/hooks/useSettings';
import { useBattle } from '../BattleContext';
import { BattleCubeLink, BattleCubeStatus } from './battle_cube_link';

/**
 * Owns one smart cube per player and keeps both pointed at the round's scramble.
 *
 * The two links are created lazily, on the first connect, so a battle played by tapping the
 * screen never builds a Bluetooth stack it will not use.
 *
 * Connecting is deliberately serial: the native adapter can only hold one scan at a time
 * (see the scan lock in battle_cube_link.ts), and both players share the one scanning picker.
 * A second connect while the first is still open is refused with a toast rather than queued,
 * because the player is standing there looking at a device list that belongs to someone else.
 *
 * Links are keyed by SLOT ('a' / 'b'), not by player, and a separate assignment maps players
 * onto slots. Switching sides then costs one swap of that map: the physical cubes change hands
 * along with the players, and neither link has to be torn down and paired again. Keying the
 * links by player directly would have baked the old player into each link's callbacks, and a
 * switch would have started recording each player's solves against the other's name.
 */

export type BattlePlayer = 1 | 2;
type CubeSlot = 'a' | 'b';

const IDLE_STATUS: BattleCubeStatus = {
	state: 'idle',
	deviceName: null,
	batteryLevel: null,
	error: null,
	physicallySolved: null,
	deviceId: null,
	persistentId: null,
};

/** What a 3D view needs to mirror one player's cube. */
export interface BattleCubeStream {
	turns: SmartTurn[];
	facelets: string | null;
}

const EMPTY_STREAM: BattleCubeStream = { turns: [], facelets: null };

interface BattleCubesValue {
	status: Record<BattlePlayer, BattleCubeStatus>;
	stream: Record<BattlePlayer, BattleCubeStream>;
	connect: (player: BattlePlayer) => Promise<void>;
	disconnect: (player: BattlePlayer) => void;
	/** Hand each player's cube to the other side, alongside a SWITCH_SIDES dispatch. */
	swapPlayers: () => void;
	/** Tell this player's cube its current physical position is the solved one. */
	markSolved: (player: BattlePlayer) => Promise<boolean>;
	/** Follow this player's cube gyroscope, for the 3D mirror. Returns an unsubscribe. */
	subscribeGyro: (player: BattlePlayer, listener: (event: any) => void) => () => void;
	/**
	 * Point this player's engine events at a handler. Returns an unsubscribe.
	 *
	 * The timer registers a stable wrapper around a ref rather than the handler itself, so
	 * the subscription survives every render while the handler it calls stays current.
	 */
	registerHandler: (player: BattlePlayer, handler: (event: SmartEngineEvent) => void) => () => void;
}

const BattleCubesCtx = createContext<BattleCubesValue | null>(null);

export function BattleCubesProvider({ children }: { children: React.ReactNode }) {
	const dispatch = useDispatch();
	const { t } = useTranslation();
	const { state } = useBattle();

	const [slotStatus, setSlotStatus] = useState<Record<CubeSlot, BattleCubeStatus>>({
		a: IDLE_STATUS,
		b: IDLE_STATUS,
	});

	const [slotStream, setSlotStream] = useState<Record<CubeSlot, BattleCubeStream>>({
		a: EMPTY_STREAM,
		b: EMPTY_STREAM,
	});

	const linksRef = useRef<Record<CubeSlot, BattleCubeLink | null>>({ a: null, b: null });
	const handlersRef = useRef<Record<BattlePlayer, ((event: SmartEngineEvent) => void) | null>>({
		1: null,
		2: null,
	});
	/** Which slot each player currently holds. Flipped by swapPlayers. */
	const assignRef = useRef<Record<BattlePlayer, CubeSlot>>({ 1: 'a', 2: 'b' });
	const [assign, setAssign] = useState<Record<BattlePlayer, CubeSlot>>({ 1: 'a', 2: 'b' });
	const scanModalOpenRef = useRef(false);

	// The scramble a freshly connected cube has to be pointed at. Read inside async connect
	// flows, where the closure would otherwise hold whatever scramble was current when the
	// player tapped Connect.
	const scrambleRef = useRef(state.currentScramble);
	scrambleRef.current = state.currentScramble;

	// Same setting the timer page and rooms pass to their engines, so a cube behaves the same
	// on all three screens. Kept in a ref as well: links are built inside a callback that must
	// not be rebuilt every time the setting changes.
	const moveOrderFix = !!useSettings('smart_cube_move_order_fix');
	const moveOrderFixRef = useRef(moveOrderFix);
	moveOrderFixRef.current = moveOrderFix;

	/**
	 * Bluetooth readiness, resolved once on mount instead of inside the connect handler.
	 *
	 * Chrome only accepts requestDevice while the user gesture is still live, and an `await`
	 * inside the handler ends it. Two awaits used to sit between the tap and the picker: the
	 * adapter's dynamic import and the availability query. The import only costs time the FIRST
	 * time, which is exactly why the first press failed and the second one worked.
	 */
	const bleReadyRef = useRef(false);
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				await getBleAdapter();
				const available = !!navigator.bluetooth && (await navigator.bluetooth.getAvailability());
				if (!cancelled) bleReadyRef.current = available;
			} catch (e) {
				if (!cancelled) bleReadyRef.current = false;
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const playerOfSlot = useCallback((slot: CubeSlot): BattlePlayer => {
		return assignRef.current[1] === slot ? 1 : 2;
	}, []);

	const getLink = useCallback(
		(slot: CubeSlot): BattleCubeLink => {
			const existing = linksRef.current[slot];
			if (existing) return existing;

			const link = new BattleCubeLink({
				label: slot,
				// Resolved at call time, never captured: after a side switch this same cube
				// belongs to the other player and its events have to follow.
				onEvent: (event) => handlersRef.current[playerOfSlot(slot)]?.(event),
				onStatus: (next) => setSlotStatus((prev) => ({ ...prev, [slot]: next })),
				onStream: (turns, facelets) => setSlotStream((prev) => ({ ...prev, [slot]: { turns, facelets } })),
				moveOrderFix: moveOrderFixRef.current,
			});
			// Before the cube ever speaks. An engine still holding the empty default would
			// treat an already-solved cube as "scramble complete" the moment it connected.
			link.setScramble(scrambleRef.current);
			linksRef.current[slot] = link;
			return link;
		},
		[playerOfSlot]
	);

	const closeScanModal = useCallback(() => {
		if (!scanModalOpenRef.current) return;
		scanModalOpenRef.current = false;
		dispatch(closeModal());
	}, [dispatch]);

	/**
	 * Run a connect attempt and settle the UI around it.
	 *
	 * Shared with the picker's Retry button, which runs a second attempt on the same link
	 * without going back through the modal. Handled here rather than at each call site
	 * because a retry that succeeded used to leave the cube pointed at no scramble.
	 */
	const runConnect = useCallback(
		async (link: BattleCubeLink, excludeDeviceIds: string[] = []) => {
			const result = await link.connect(excludeDeviceIds);

			if (result.ok) {
				// Undo a duplicate pairing.
				//
				// On web the exclusion list above cannot prevent this: every scan mints a new
				// `web_N` id for the same physical cube, and Chrome's picker cannot be filtered.
				// The stable identity only exists after the handshake, so the check has to be
				// here. Leaving it would put both players on one cube: every turn lands on both
				// links, the timers run as one, and the two drivers fight over the same GATT
				// write ("GATT operation already in progress"), which drops the connection.
				const identity = link.getStatus().persistentId;
				const clash =
					identity &&
					(['a', 'b'] as CubeSlot[]).some(
						(s) => linksRef.current[s] && linksRef.current[s] !== link && linksRef.current[s].getStatus().persistentId === identity
					);
				if (clash) {
					void link.disconnect();
					closeScanModal();
					toastError(t('battle.cube_already_in_play'));
					return;
				}

				// A cube that joins mid-battle starts from the round in progress, not from the
				// scramble that was current when the picker opened.
				link.setScramble(scrambleRef.current);
				closeScanModal();
			} else if (result.reason === 'scan_busy') {
				// A failed handshake otherwise leaves the picker open on its error state so the
				// player can retry from there. Only what the picker cannot explain gets a toast.
				closeScanModal();
				toastError(t('battle.cube_scan_busy'));
			}
		},
		[closeScanModal, t]
	);

	const connect = useCallback(
		async (player: BattlePlayer) => {
			const slot = assignRef.current[player];
			const link = getLink(slot);
			if (link.connected || link.busy) return;

			const otherSlot: CubeSlot = slot === 'a' ? 'b' : 'a';
			const otherLink = linksRef.current[otherSlot];
			if (otherLink?.busy) {
				toastError(t('battle.cube_scan_busy'));
				return;
			}

			// Keep this player off the cube the other one is already holding. Picking the same
			// physical cube twice looks like it worked: the second driver takes over the BLE
			// notification and the first link goes silent while still showing "connected".
			const excludeDeviceIds: string[] = [];
			const otherDeviceId = otherLink?.getStatus().deviceId;
			if (otherDeviceId) excludeDeviceIds.push(otherDeviceId);

			// The app-wide manager keeps its cube across pages on purpose, so a cube paired on
			// the timer page is still live here. Its BLE handle is not exposed, so it cannot be
			// excluded from the list; naming it is the most we can do, and disconnecting it is
			// the user's call, not ours.
			const managerSnapshot = getSmartCubeManager().getSnapshot();
			if (managerSnapshot.connected) {
				toastError(t('battle.cube_held_elsewhere', { name: managerSnapshot.deviceName || '' }));
			}

			if (isNative()) {
				// Native BLE has no OS-level chooser: requestDevice stays pending until the
				// picker calls selectScannedDevice. Without this modal the scan would simply
				// hang until its 60s timeout.
				scanModalOpenRef.current = true;
				dispatch(
					openModal(
						<BleScanningModal
							mode="smartcube"
							onCancel={() => {
								link.cancelScan();
								closeScanModal();
							}}
							onRetry={() => {
								void runConnect(link, excludeDeviceIds);
							}}
						/>,
						{
							position: 'bottom',
							hideCloseButton: true,
							disableBackdropClick: true,
						}
					)
				);
			} else {
				// Read, never awaited: see bleReadyRef. Anything asynchronous here would spend
				// the user gesture the picker needs.
				if (!bleReadyRef.current) {
					dispatch(openModal(<BluetoothErrorMessage />));
					return;
				}
			}

			await runConnect(link, excludeDeviceIds);
		},
		[dispatch, getLink, runConnect, closeScanModal, t]
	);

	const disconnect = useCallback(
		(player: BattlePlayer) => {
			closeScanModal();
			void linksRef.current[assignRef.current[player]]?.disconnect();
		},
		[closeScanModal]
	);

	const markSolved = useCallback(
		async (player: BattlePlayer) => {
			const link = linksRef.current[assignRef.current[player]];
			if (!link?.connected) return false;
			const ok = await link.markSolved();
			// The cube can refuse the command (busy radio, or a model whose firmware has no
			// reset). Saying so beats a button that looks like it worked.
			if (!ok) toastError(t('battle.cube_mark_solved_failed'));
			return ok;
		},
		[t]
	);

	const subscribeGyro = useCallback((player: BattlePlayer, listener: (event: any) => void) => {
		// Resolved through the slot map, so after a side switch the mirror follows the cube
		// that actually moved to this side.
		const link = linksRef.current[assignRef.current[player]];
		if (!link) return () => { /* no cube on this side yet */ };
		return link.subscribeGyro(listener);
	}, []);

	const swapPlayers = useCallback(() => {
		const next: Record<BattlePlayer, CubeSlot> = {
			1: assignRef.current[2],
			2: assignRef.current[1],
		};
		assignRef.current = next;
		setAssign(next);
	}, []);

	const registerHandler = useCallback(
		(player: BattlePlayer, handler: (event: SmartEngineEvent) => void) => {
			handlersRef.current[player] = handler;
			return () => {
				if (handlersRef.current[player] === handler) handlersRef.current[player] = null;
			};
		},
		[]
	);

	// Toggling the setting must take effect without rebuilding a link mid-battle: that would
	// drop the tracker and any solve in progress.
	useEffect(() => {
		linksRef.current.a?.setMoveOrderFix(moveOrderFix);
		linksRef.current.b?.setMoveOrderFix(moveOrderFix);
	}, [moveOrderFix]);

	// Both cubes follow the round. currentScramble is the single source: the reducer bakes the
	// next one the moment both players finish, and promotes it into a fresh round when the next
	// one starts, so it is already correct before anyone touches a cube.
	useEffect(() => {
		linksRef.current.a?.setScramble(state.currentScramble);
		linksRef.current.b?.setScramble(state.currentScramble);
	}, [state.currentScramble]);

	// Leaving the page drops both links. Unlike the timer page there is nothing to keep alive:
	// a battle is two people at one table, and a cube left connected to a page nobody is on
	// would just hold its radio open.
	useEffect(
		() => () => {
			linksRef.current.a?.dispose();
			linksRef.current.b?.dispose();
			linksRef.current = { a: null, b: null };
		},
		[]
	);

	const status: Record<BattlePlayer, BattleCubeStatus> = {
		1: slotStatus[assign[1]],
		2: slotStatus[assign[2]],
	};
	const stream: Record<BattlePlayer, BattleCubeStream> = {
		1: slotStream[assign[1]],
		2: slotStream[assign[2]],
	};

	return (
		<BattleCubesCtx.Provider value={{ status, stream, connect, disconnect, swapPlayers, markSolved, subscribeGyro, registerHandler }}>
			{children}
		</BattleCubesCtx.Provider>
	);
}

export function useBattleCubes(): BattleCubesValue {
	const ctx = useContext(BattleCubesCtx);
	if (!ctx) throw new Error('useBattleCubes must be used within BattleCubesProvider');
	return ctx;
}
