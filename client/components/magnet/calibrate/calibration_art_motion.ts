// Motion of the calibration page's step drawings (CalibrationArt.tsx). Pure: each scene is a
// function of time, sampled into Web Animations keyframes for the looping drawing and into one
// still frame for reduced motion and the first paint, so the loop and the still never disagree.
//
// The drawing is an oblique view of the table from the user's seat: x to the right, y toward the
// user, z up, in table units (the cube is 44, about 57 mm). The phone lies screen up with its top
// end away from the user. Objects are drawn phone first, then the cube, so the cube is only ever
// beyond the phone's top end, beside it, or lifted above it (never behind it at table height).

export type ArtScene = 'steady' | 'sweep' | 'rest' | 'away';

/** Elements of the drawing the scenes move, by their data-part attribute. */
export type ArtPart = 'cube' | 'cube-shadow' | 'case' | 'case-shadow' | 'actors' | 'bar' | 'ready' | 'check';

export interface PartStyle {
	transform?: string;
	opacity?: number;
}

export type ArtStyles = Partial<Record<ArtPart, PartStyle>>;
export type ArtKeyframes = Partial<Record<ArtPart, Array<PartStyle & { offset: number }>>>;

/** Table depth and height on screen: the camera looks down at about 60 degrees. */
export const TY = 0.86;
export const TZ = 0.5;
/** Screen y of the table line y = 0. */
export const OY = 24;
export const VIEW = { w: 320, h: 184 };

/** The phone: footprint corner, width, length, thickness. */
export const PHONE = { x: 130, y: 62, w: 60, l: 118, t: 6 };
export const CUBE = 44;
/** An earbud case: one of the magnetic things step 1 asks to move away. */
export const EARBUDS = { w: 28, d: 22, h: 14 };

/**
 * The drawn phone's magnetometer: near the top right seen from the screen, by the rear camera.
 * Only the bar on the drawn screen uses it; the page text says the real spot varies by phone.
 */
const SENSOR = { x: PHONE.x + PHONE.w - 6, y: PHONE.y + 12, z: 3 };

export interface Pose {
	x: number;
	y: number;
	z: number;
}

type Ease = 'linear' | 'in' | 'out' | 'inOut';

/** A value at a time; `ease` shapes the segment that ends here. */
interface Key {
	t: number;
	v: number[];
	ease: Ease;
}

const at = (t: number, x: number, y: number, z: number, ease: Ease = 'linear'): Key => ({ t, v: [x, y, z], ease });
const level = (t: number, v: number, ease: Ease = 'linear'): Key => ({ t, v: [v], ease });

function eased(kind: Ease, f: number): number {
	switch (kind) {
		case 'in':
			return f * f * f;
		case 'out':
			return 1 - (1 - f) ** 3;
		case 'inOut':
			return f < 0.5 ? 4 * f * f * f : 1 - (-2 * f + 2) ** 3 / 2;
		default:
			return f;
	}
}

/** Value of a key track at time t: held before the first and after the last key. */
export function sampleKeys(keys: Key[], t: number): number[] {
	if (t <= keys[0].t) return keys[0].v;
	for (let i = 1; i < keys.length; i++) {
		const b = keys[i];
		if (t > b.t) continue;
		const a = keys[i - 1];
		const span = b.t - a.t;
		const f = span > 0 ? eased(b.ease, (t - a.t) / span) : 1;
		return a.v.map((v, j) => v + (b.v[j] - v) * f);
	}
	return keys[keys.length - 1].v;
}

/** Where the cube rests before a solve in the drawing: beyond the top edge, by the sensor. */
export const REST_SPOT = { x: PHONE.x + PHONE.w - 10, y: PHONE.y - 6 - CUBE / 2 };

// The sweep's stops around the top of the phone: corners, the top edge, the upper sides.
const TOP = { x: PHONE.x + PHONE.w / 2, y: PHONE.y - 28 };
const TOP_RIGHT = { x: PHONE.x + PHONE.w + 18, y: PHONE.y - 26 };
const RIGHT = { x: PHONE.x + PHONE.w + 28, y: PHONE.y + 24 };
const TOP_LEFT = { x: PHONE.x - 18, y: PHONE.y - 26 };
const LEFT = { x: PHONE.x - 28, y: PHONE.y + 24 };

/** The sweep's route on the table, through the stops in order (CalibrationArt draws it dashed). */
export const SWEEP_ROUTE = [LEFT, TOP_LEFT, TOP, TOP_RIGHT, RIGHT];

/** Height a hand holds the cube at during the sweep: above the phone even at the bob's low point. */
const HOVER = 10;

interface SceneDef {
	ms: number;
	/** Time of the still frame (reduced motion, first paint). */
	still: number;
	cube: Key[];
	earbuds?: Key[];
	/** Visibility of the moving things: fades hide the jump back to the first pose. */
	actors: Key[];
	/** The digits and the bar turn green: the cube rests where it counts as ready. */
	ready: Key[];
	/** The check on the screen: phone steady, field back to the baseline. */
	check: Key[];
	/** Amplitude of the hand's up and down motion, table units (one period per quarter loop). */
	bob?: number;
}

const zero = [level(0, 0)];
const shown = [level(0, 1)];

const SCENES: Record<ArtScene, SceneDef> = {
	// Phone on the table; the cube and the earbud case are moved away, then the check.
	steady: {
		ms: 6000,
		still: 4600,
		cube: [
			at(0, REST_SPOT.x, REST_SPOT.y, 0),
			at(1300, REST_SPOT.x, REST_SPOT.y, 0),
			at(1650, REST_SPOT.x, REST_SPOT.y, 16, 'out'),
			at(2650, 278, 132, 16, 'inOut'),
			at(2950, 278, 132, 0, 'in'),
		],
		earbuds: [
			at(0, PHONE.x - 26, PHONE.y + 46, 0),
			at(1700, PHONE.x - 26, PHONE.y + 46, 0),
			at(2000, PHONE.x - 26, PHONE.y + 46, 10, 'out'),
			at(2900, 40, 140, 10, 'inOut'),
			at(3150, 40, 140, 0, 'in'),
		],
		actors: [level(0, 0), level(250, 1), level(5650, 1), level(6000, 0)],
		ready: zero,
		check: [level(0, 0), level(3500, 0), level(3800, 1, 'out'), level(5650, 1), level(6000, 0)],
	},
	// The cube held around the top of the phone: top edge, both corners, the upper sides. The
	// loop ends where it starts, so it never fades.
	sweep: {
		ms: 7600,
		still: 2050,
		cube: [
			at(0, TOP.x, TOP.y, HOVER),
			at(900, TOP_RIGHT.x, TOP_RIGHT.y, HOVER, 'inOut'),
			at(1200, TOP_RIGHT.x, TOP_RIGHT.y, HOVER),
			at(2000, RIGHT.x, RIGHT.y, HOVER, 'inOut'),
			at(2300, RIGHT.x, RIGHT.y, HOVER),
			at(3100, TOP_RIGHT.x, TOP_RIGHT.y, HOVER, 'inOut'),
			at(3900, TOP.x, TOP.y, HOVER, 'inOut'),
			at(4700, TOP_LEFT.x, TOP_LEFT.y, HOVER, 'inOut'),
			at(5000, TOP_LEFT.x, TOP_LEFT.y, HOVER),
			at(5800, LEFT.x, LEFT.y, HOVER, 'inOut'),
			at(6100, LEFT.x, LEFT.y, HOVER),
			at(6800, TOP_LEFT.x, TOP_LEFT.y, HOVER, 'inOut'),
			at(7600, TOP.x, TOP.y, HOVER, 'inOut'),
		],
		actors: shown,
		ready: zero,
		check: zero,
		bob: 3,
	},
	// The cube comes down onto its spot; once it lies still the reading turns green.
	rest: {
		ms: 5600,
		still: 4000,
		cube: [
			at(0, 262, PHONE.y + 30, 30),
			at(300, 262, PHONE.y + 30, 30),
			at(1500, REST_SPOT.x, REST_SPOT.y, 16, 'inOut'),
			at(2100, REST_SPOT.x, REST_SPOT.y, 0, 'inOut'),
		],
		actors: [level(0, 0), level(250, 1), level(5250, 1), level(5600, 0)],
		ready: [level(0, 0), level(2700, 0), level(2950, 1, 'out'), level(5250, 1), level(5600, 0)],
		check: zero,
	},
	// The cube is lifted off its spot and taken away; the reading falls back, then the check.
	away: {
		ms: 5600,
		still: 4000,
		cube: [
			at(0, REST_SPOT.x, REST_SPOT.y, 0),
			at(1000, REST_SPOT.x, REST_SPOT.y, 0),
			at(1350, REST_SPOT.x, REST_SPOT.y, 18, 'out'),
			at(2450, 272, 120, 18, 'inOut'),
			at(2750, 272, 120, 0, 'in'),
		],
		actors: [level(0, 0), level(250, 1), level(5250, 1), level(5600, 0)],
		ready: [level(0, 0), level(250, 1), level(1000, 1), level(1200, 0)],
		check: [level(0, 0), level(3200, 0), level(3450, 1, 'out'), level(5250, 1), level(5600, 0)],
	},
};

export function sceneMs(scene: ArtScene): number {
	return SCENES[scene].ms;
}

function distanceToSensor(p: Pose): number {
	return Math.hypot(p.x - SENSOR.x, p.y - SENSOR.y, p.z + CUBE / 2 - SENSOR.z);
}

const REST_DISTANCE = distanceToSensor({ ...REST_SPOT, z: 0 });

/**
 * The bar on the drawn screen for a cube pose, 0..1: falls with the cube of the distance like a
 * real magnet, scaled like the timer's live bar so the resting cube fills about 80 %.
 */
export function fieldBar(p: Pose): number {
	const share = (REST_DISTANCE / distanceToSensor(p)) ** 3;
	return Math.min(1, 0.8 * Math.min(1.25, share));
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Screen offset of an object whose footprint is centred at (x, y) and whose bottom is at z. */
function place(p: Pose, size: number, depth: number): string {
	return `translate(${round(p.x - size / 2)}px, ${round(OY + (p.y - depth / 2) * TY - p.z * TZ)}px)`;
}

/**
 * Shadow on the table under a pose (drawn centred on the origin): a little toward the bottom
 * right of the footprint, smaller and lighter the higher the object is held.
 */
function shadow(p: Pose): PartStyle {
	const lift = Math.min(Math.max(p.z, 0), 40);
	const scale = round(1 - lift / 90);
	return {
		transform: `translate(${round(p.x + 2)}px, ${round(OY + p.y * TY + 2.5)}px) scale(${scale})`,
		opacity: round(1 - lift / 70),
	};
}

function pose(keys: Key[], t: number): Pose {
	const [x, y, z] = sampleKeys(keys, t);
	return { x, y, z };
}

/** The cube's pose at time t of a scene, the hand's motion included. */
export function cubeAt(scene: ArtScene, t: number): Pose {
	const def = SCENES[scene];
	const p = pose(def.cube, t);
	if (def.bob) p.z += def.bob * Math.sin((2 * Math.PI * t * 4) / def.ms);
	return p;
}

/** Every moving part of a scene at time t (ms into the loop). */
export function sceneStyles(scene: ArtScene, t: number): ArtStyles {
	const def = SCENES[scene];
	const cube = cubeAt(scene, t);
	const actors = sampleKeys(def.actors, t)[0];
	const styles: ArtStyles = {
		cube: { transform: place(cube, CUBE, CUBE) },
		'cube-shadow': shadow(cube),
		actors: { opacity: round(actors) },
		bar: { transform: `scaleX(${round(fieldBar(cube) * actors)})` },
		ready: { opacity: round(sampleKeys(def.ready, t)[0]) },
		check: { opacity: round(sampleKeys(def.check, t)[0]) },
	};
	if (def.earbuds) {
		const earbuds = pose(def.earbuds, t);
		styles.case = { transform: place(earbuds, EARBUDS.w, EARBUDS.d) };
		styles['case-shadow'] = shadow(earbuds);
	}
	return styles;
}

/** The frame shown without motion (reduced motion) and before the loop starts. */
export function stillStyles(scene: ArtScene): ArtStyles {
	return sceneStyles(scene, SCENES[scene].still);
}

/**
 * Keyframes of every moving part, sampled every `stepMs` and played linearly: the easing is
 * already in the samples, so all parts stay in step with one shared duration.
 */
export function sceneKeyframes(scene: ArtScene, stepMs = 50): ArtKeyframes {
	const { ms } = SCENES[scene];
	const steps = Math.max(2, Math.round(ms / stepMs));
	const out: ArtKeyframes = {};
	for (let i = 0; i <= steps; i++) {
		const t = (ms * i) / steps;
		const styles = sceneStyles(scene, t);
		for (const part of Object.keys(styles) as ArtPart[]) {
			(out[part] = out[part] || []).push({ ...styles[part], offset: Math.round((i / steps) * 1e4) / 1e4 });
		}
	}
	return out;
}

/** A smooth path through points (Catmull-Rom as cubic Beziers), in table coordinates. */
export function smoothPath(points: Array<{ x: number; y: number }>): string {
	if (points.length < 2) return '';
	const p = (i: number) => points[Math.min(Math.max(i, 0), points.length - 1)];
	let d = `M${p(0).x} ${p(0).y}`;
	for (let i = 0; i < points.length - 1; i++) {
		const [a, b, c, e] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
		const c1 = { x: round(b.x + (c.x - a.x) / 6), y: round(b.y + (c.y - a.y) / 6) };
		const c2 = { x: round(c.x - (e.x - b.x) / 6), y: round(c.y - (e.y - b.y) / 6) };
		d += ` C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${c.x} ${c.y}`;
	}
	return d;
}
