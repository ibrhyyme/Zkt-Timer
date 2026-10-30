import * as THREE from 'three';

import type { CubeRenderer } from './render/cube_renderer';
import { HOME_TILT_DEG, HOME_TURN_DEG } from './view_defaults';

/**
 * Turning a 3D cube view by dragging it, as cubing.js's orbit controls did in the views our
 * engine replaced: across the cube's whole width is half a turn, a vertical drag a little
 * less. Yaw is about the cube's up and pitch about the screen's horizontal, so the cube never
 * rolls, and the pitch stops short of straight down or up. A flick keeps turning after
 * release and fades out.
 *
 * It starts at the live cube's home view (view_defaults.ts) and hands the view out as a
 * quaternion the caller puts on top of the cube's own orientation (the gyro, a solver's
 * frame). No React and no listeners of its own: the caller wires the pointer events to it
 * and steps the fling in its frame loop.
 */

const DRAG_DEG_PER_SIDE = 180;
const DRAG_VERTICAL_SCALE = 0.75;
const MAX_PITCH_DEG = 85;
/** Time constant of the fling's fade. */
const FLING_MS = 150;
/** Only a pointer that was still moving this recently at release flings. */
const FLING_WINDOW_MS = 60;
/** Degrees per ms; a fast flick coasts at most this fast. */
const MAX_FLING_SPEED = 2;
const DEG = Math.PI / 180;

/** The parts of a pointer event the drag reads (React's synthetic event or a DOM one). */
export interface DragPointer {
	pointerId: number;
	pointerType: string;
	button: number;
	clientX: number;
	clientY: number;
	timeStamp: number;
	type: string;
	currentTarget: EventTarget | null;
}

const clampSpeed = (v: number) => Math.max(-MAX_FLING_SPEED, Math.min(MAX_FLING_SPEED, v));

export class ViewDrag {
	/** Degrees. */
	private pitch = HOME_TILT_DEG;
	private yaw = -HOME_TURN_DEG;
	/** The pointer turning the view, -1 for none. One at a time. */
	private pointer = -1;
	private x = 0;
	private y = 0;
	private at = 0;
	/** Degrees per ms, for the fling. */
	private vPitch = 0;
	private vYaw = 0;
	private euler = new THREE.Euler();

	/** Back to the home view, nothing held, nothing coasting. */
	reset() {
		this.pitch = HOME_TILT_DEG;
		this.yaw = -HOME_TURN_DEG;
		this.pointer = -1;
		this.vPitch = this.vYaw = 0;
	}

	/** The view: SmartCubeView's home quaternion with the drag added to its tilt and turn. */
	quat(out: THREE.Quaternion): THREE.Quaternion {
		return out.setFromEuler(this.euler.set(this.pitch * DEG, this.yaw * DEG, 0));
	}

	/** Coasting after a flick (the caller keeps its frames coming while this holds). */
	get flinging(): boolean {
		return this.pointer === -1 && (this.vPitch !== 0 || this.vYaw !== 0);
	}

	/** Coast the fling on by `dtMs`. True while it still moves. */
	step(dtMs: number): boolean {
		if (!this.flinging) return false;
		this.turn(this.vPitch * dtMs, this.vYaw * dtMs);
		const decay = Math.exp(-dtMs / FLING_MS);
		this.vPitch *= decay;
		this.vYaw *= decay;
		if (Math.abs(this.vPitch) + Math.abs(this.vYaw) < 0.002) this.vPitch = this.vYaw = 0;
		return this.flinging;
	}

	down(e: DragPointer) {
		if (this.pointer !== -1 || (e.pointerType === 'mouse' && e.button !== 0)) return;
		this.pointer = e.pointerId;
		this.x = e.clientX;
		this.y = e.clientY;
		this.at = e.timeStamp;
		this.vPitch = this.vYaw = 0;
		try {
			(e.currentTarget as Element | null)?.setPointerCapture(e.pointerId);
		} catch {
			// The pointer is already gone; its up event ends the drag all the same.
		}
	}

	/** True when the view turned, so the caller draws. */
	move(e: DragPointer): boolean {
		if (e.pointerId !== this.pointer) return false;
		const side = (e.currentTarget as Element | null)?.clientWidth || 1;
		const dYaw = ((e.clientX - this.x) / side) * DRAG_DEG_PER_SIDE;
		const dPitch = ((e.clientY - this.y) / side) * DRAG_DEG_PER_SIDE * DRAG_VERTICAL_SCALE;
		const dt = Math.max(1, e.timeStamp - this.at);
		// Smoothed over the last two moves: one event alone is too noisy to fling with.
		this.vYaw = clampSpeed((this.vYaw + dYaw / dt) / 2);
		this.vPitch = clampSpeed((this.vPitch + dPitch / dt) / 2);
		this.x = e.clientX;
		this.y = e.clientY;
		this.at = e.timeStamp;
		this.turn(dPitch, dYaw);
		return true;
	}

	/** Pointer up or cancelled. Let go while still moving, the view coasts on; held still first, it stays. */
	end(e: DragPointer) {
		if (e.pointerId !== this.pointer) return;
		this.pointer = -1;
		if (e.type === 'pointercancel' || e.timeStamp - this.at > FLING_WINDOW_MS) this.vPitch = this.vYaw = 0;
	}

	private turn(dPitch: number, dYaw: number) {
		this.yaw = (this.yaw + dYaw) % 360;
		const pitch = this.pitch + dPitch;
		this.pitch = Math.max(-MAX_PITCH_DEG, Math.min(MAX_PITCH_DEG, pitch));
		if (this.pitch !== pitch) this.vPitch = 0;
	}
}

/**
 * For a view whose orientation is the drag alone (no gyro or solver frame under it): puts the
 * cube where the drag says at once, and coasts a flick on in frames of its own. `show` after
 * every move and release; `stop` when the cube goes.
 */
export function followDrag(cube: CubeRenderer, drag: ViewDrag): { show(): void; stop(): void } {
	const q = new THREE.Quaternion();
	let raf = 0;
	let lastAt = 0;
	const coast = () => {
		raf = 0;
		const now = performance.now();
		const moving = drag.step(now - lastAt);
		lastAt = now;
		cube.setOrientation(drag.quat(q), true);
		if (moving) raf = requestAnimationFrame(coast);
	};
	return {
		show() {
			cube.setOrientation(drag.quat(q), true);
			if (drag.flinging && !raf) {
				lastAt = performance.now();
				raf = requestAnimationFrame(coast);
			}
		},
		stop() {
			if (raf) cancelAnimationFrame(raf);
			raf = 0;
		},
	};
}
