// Ready-made timer backgrounds (Appearance > Ready-made backgrounds). Each one is a fragment
// shader drawn live behind the timer, so it takes the colours of whatever theme is on,
// including colours the user picked by hand, and costs no download. A still background is
// the same shader drawn once. Free for everyone; the themes that colour them stay Pro.
//
// Kept free of DOM and React so the list and the sources can be tested in node.

export const PRESET_BACKGROUND_IDS = ['aurora', 'liquid', 'galaxy', 'horizon', 'topo', 'bokeh'] as const;

export type PresetBackgroundId = (typeof PRESET_BACKGROUND_IDS)[number];

export function isPresetBackgroundId(value: unknown): value is PresetBackgroundId {
	return typeof value === 'string' && (PRESET_BACKGROUND_IDS as readonly string[]).includes(value);
}

/** Shader time of a still background, and where a moving one starts. A frame that reads well. */
export const PRESET_STILL_TIME = 14;

export const PRESET_VERTEX_SOURCE = `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

const COMMON = `
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_bg;
uniform vec3 u_mod;
uniform vec3 u_pri;
uniform vec3 u_sec;
uniform vec3 u_txt;
uniform float u_light;

float hash(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}
float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
	float v = 0.0;
	float a = 0.5;
	mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
	for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
	return v;
}
// Screen on a dark theme, a multiply tint on a light one, so one scene suits both.
vec3 blendc(vec3 base, vec3 c, float k) {
	k = clamp(k, 0.0, 1.0);
	vec3 scr = 1.0 - (1.0 - base) * (1.0 - c * k);
	vec3 mul = base * mix(vec3(1.0), c, k * 0.85);
	return mix(scr, mul, u_light);
}
float stars(vec2 p, float scale, float density) {
	vec2 g = p * scale;
	vec2 id = floor(g);
	vec2 f = fract(g) - 0.5;
	float h = hash(id);
	if (h < density) return 0.0;
	vec2 off = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
	float d = length(f - off * 0.7);
	float s = (h - density) / (1.0 - density);
	float tw = 0.6 + 0.4 * sin(u_time * (0.8 + h * 2.5) + h * 50.0);
	return smoothstep(0.05 + 0.06 * s, 0.0, d) * tw;
}
`;

const BODIES: Record<PresetBackgroundId, string> = {
	aurora: `
vec3 scene(vec2 fc) {
	vec2 uv = fc / u_res;
	float asp = u_res.x / u_res.y;
	float x = uv.x * asp;
	float t = u_time * 0.05;
	vec3 col = mix(u_bg, u_mod, 0.5 * (1.0 - uv.y));
	col = blendc(col, u_txt, stars(vec2(x, uv.y), 70.0, 0.965) * 0.6 * (1.0 - u_light));
	for (int i = 0; i < 3; i++) {
		float fi = float(i);
		float xx = x * 0.8 + fi * 2.3;
		float c = 0.62 + fi * 0.07 + (fbm(vec2(xx * 0.9 + t * (1.0 + fi * 0.4), fi * 3.1 + t * 0.6)) - 0.5) * 0.55;
		float d = uv.y - c;
		float lower = smoothstep(-0.015, 0.03, d);
		float upper = exp(-max(d, 0.0) * (4.0 + fi * 1.5));
		float streak = 0.45 + 0.55 * noise(vec2(xx * 22.0, t * 3.0 + fi * 7.0));
		float k = lower * upper * streak * (0.75 - fi * 0.17);
		vec3 cc = mix(u_sec, u_pri, clamp(d * 2.6 + fi * 0.25, 0.0, 1.0));
		col = blendc(col, cc, k);
	}
	return col;
}`,
	liquid: `
vec3 scene(vec2 fc) {
	vec2 p = (fc - 0.5 * u_res) / u_res.y;
	float t = u_time * 0.04;
	vec2 q = vec2(fbm(p * 1.3 + vec2(0.0, t)), fbm(p * 1.3 + vec2(5.2, 1.3) - t));
	vec2 r = vec2(fbm(p * 1.3 + 2.2 * q + vec2(1.7, 9.2) + t * 1.2), fbm(p * 1.3 + 2.2 * q + vec2(8.3, 2.8) - t * 0.8));
	float f = fbm(p * 1.3 + 2.4 * r);
	vec3 c = mix(u_pri, u_sec, smoothstep(0.2, 0.9, q.x));
	c = mix(c, mix(u_pri, u_txt, 0.25), smoothstep(0.55, 0.95, r.y) * 0.6);
	float k = smoothstep(0.22, 0.68, f);
	vec3 col = mix(u_bg, u_mod, 0.4);
	return blendc(col, c, k * 0.95);
}`,
	galaxy: `
vec3 scene(vec2 fc) {
	vec2 p = (fc - u_res * vec2(0.7, 0.64)) / u_res.y * 0.75;
	float t = u_time * 0.025;
	float r = length(p);
	float a = atan(p.y, p.x);
	float sw = a + r * 4.0 - t * 2.0;
	vec2 sp = vec2(cos(sw), sin(sw)) * r;
	float arms = 0.5 + 0.5 * cos(2.0 * (a - log(r + 0.05) * 2.2 + t * 2.0));
	float neb = fbm(sp * 3.0 + vec2(t, -t));
	float core = exp(-r * 7.0);
	float k = (neb * arms * 1.2 + core * 0.9) * smoothstep(1.1, 0.05, r);
	vec3 c = mix(u_sec, u_pri, smoothstep(0.0, 0.6, r + (neb - 0.5) * 0.4));
	c = mix(c, u_txt, core * 0.6);
	vec3 col = blendc(u_bg, c, k * 0.8);
	vec2 sq = (fc - 0.5 * u_res) / u_res.y;
	float st = stars(sq + vec2(t * 0.2, 0.0), 55.0, 0.955) + stars(sq + vec2(t * 0.35, 3.0), 110.0, 0.95) * 0.7;
	return blendc(col, mix(u_txt, u_sec, 0.15), st * 0.85);
}`,
	horizon: `
vec3 scene(vec2 fc) {
	vec2 uv = fc / u_res;
	float asp = u_res.x / u_res.y;
	vec2 p = vec2(uv.x * asp, uv.y);
	// The horizon sits above the time, so behind the digits and the scramble there are only
	// thin grid lines; a sun behind them made the time hard to read. Upright on a phone the
	// screen is narrow, so the sun is smaller there.
	bool portrait = asp < 1.0;
	float hz = portrait ? 0.6 : 0.56;
	float sr = portrait ? 0.085 : 0.11;
	vec3 col = u_bg;
	if (uv.y >= hz) {
		float yy = uv.y - hz;
		col = blendc(col, u_pri, exp(-yy * 5.0) * 0.45);
		col = blendc(col, u_txt, stars(p, 80.0, 0.97) * 0.5 * smoothstep(0.1, 0.5, yy) * (1.0 - u_light));
		vec2 sc = vec2(0.5 * asp, hz + sr);
		float d = length(p - sc);
		float sun = smoothstep(sr, sr - 0.003, d);
		float band = (sc.y - uv.y) / sr;
		float stripe = step(smoothstep(0.0, 1.0, band) * 0.55, fract(uv.y / sr * 6.5 + u_time * 0.25));
		sun *= band > 0.0 ? stripe : 1.0;
		vec3 sunc = mix(u_pri, u_sec, clamp(0.5 + band * 0.5, 0.0, 1.0));
		col = blendc(col, sunc, sun * 0.9);
		col = blendc(col, u_pri, exp(-max(d - sr, 0.0) * 9.0) * 0.3);
		float hill = portrait ? 0.5 : 1.0;
		float m = hz + hill * (0.05 * fbm(vec2(p.x * 2.2, 1.7)) + 0.025 * noise(vec2(p.x * 10.0, 4.0)));
		if (uv.y < m) col = mix(col, mix(u_mod, u_bg, 0.3), 0.9);
	} else {
		float yy = hz - uv.y;
		float z = 0.22 / yy;
		// Half a cell off centre, so no grid line runs down the middle of the digits.
		vec2 g = vec2((p.x - 0.5 * asp) * z * 1.8 + 0.5, z + u_time * 0.5);
		vec2 w = fwidth(g);
		vec2 l = abs(fract(g - 0.5) - 0.5) / max(w * 1.2, vec2(0.0001));
		float line = 1.0 - min(min(l.x, l.y), 1.0);
		float fade = smoothstep(0.0, 0.06, yy);
		col = mix(u_bg, u_mod, 0.6);
		col = blendc(col, u_pri, line * fade * 0.85);
		col = blendc(col, u_pri, exp(-yy * 16.0) * 0.4);
	}
	return col;
}`,
	topo: `
vec3 scene(vec2 fc) {
	vec2 p = (fc - 0.5 * u_res) / u_res.y;
	float t = u_time * 0.03;
	float h = fbm(p * 1.6 + vec2(t, -t * 0.6)) + 0.35 * fbm(p * 3.5 - vec2(t * 0.8, t * 0.3));
	float v = h * 16.0;
	float fw = fwidth(v);
	float d = abs(fract(v + 0.5) - 0.5);
	float line = 1.0 - smoothstep(0.0, fw * 1.3, d);
	float idx = floor(v + 0.5);
	float major = 1.0 - step(0.5, mod(idx, 5.0));
	vec3 c = mix(u_sec, u_pri, smoothstep(0.35, 1.0, h));
	vec3 col = blendc(mix(u_bg, u_mod, 0.35), u_pri, smoothstep(0.4, 1.2, h) * 0.18);
	return blendc(col, c, line * mix(0.38, 0.85, major));
}`,
	bokeh: `
vec3 scene(vec2 fc) {
	vec2 p = (fc - 0.5 * u_res) / u_res.y;
	float asp = u_res.x / u_res.y;
	vec3 col = mix(u_bg, u_mod, 0.5 + 0.5 * p.y);
	for (int i = 0; i < 30; i++) {
		float fi = float(i);
		float h1 = hash(vec2(fi, 1.3));
		float h2 = hash(vec2(fi, 7.1));
		float depth = hash(vec2(fi, 3.7));
		float h4 = hash(vec2(fi, 9.9));
		float r = mix(0.15, 0.03, depth);
		float y = fract(h2 + u_time * 0.01 * (1.3 - depth)) * 1.5 - 0.75;
		vec2 c = vec2((h1 - 0.5) * asp * 1.15 + sin(u_time * 0.15 + fi * 1.7) * 0.03, y);
		float d = length(p - c);
		float blur = mix(0.07, 0.01, depth);
		float disc = smoothstep(r, r - blur, d);
		vec3 bc = mix(mix(u_pri, u_sec, step(0.55, h4)), u_txt, 0.15);
		col = blendc(col, bc, disc * mix(0.28, 0.55, depth));
	}
	return col;
}`,
};

/** The full fragment shader of one background: shared helpers, its scene, and a soft vignette on dark themes. */
export function presetFragmentSource(id: PresetBackgroundId): string {
	return `#version 300 es
precision highp float;
out vec4 o;
${COMMON}
${BODIES[id]}
void main() {
	vec3 c = scene(gl_FragCoord.xy);
	vec2 q = gl_FragCoord.xy / u_res - 0.5;
	float vig = smoothstep(0.35, 0.95, length(q * vec2(u_res.x / u_res.y, 1.0)) * 0.9);
	c = mix(c, c * 0.72, vig * (1.0 - u_light));
	o = vec4(c, 1.0);
}`;
}
