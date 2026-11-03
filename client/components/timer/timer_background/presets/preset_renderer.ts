// One WebGL2 context drawing ready-made backgrounds. Programs compile the first time a
// background is drawn, so the timer only ever compiles the one it shows.

import {
	PresetBackgroundId,
	PRESET_VERTEX_SOURCE,
	presetFragmentSource,
} from './preset_shaders';
import { PresetPalette } from './theme_colors';

export interface PresetRenderer {
	/** Draws one frame into the canvas. False when the context is lost or the shader failed. */
	draw(id: PresetBackgroundId, width: number, height: number, time: number, palette: PresetPalette): boolean;
	dispose(): void;
}

interface Program {
	program: WebGLProgram;
	attrib: number;
	uniforms: Record<string, WebGLUniformLocation | null>;
}

const UNIFORMS = ['u_res', 'u_time', 'u_bg', 'u_mod', 'u_pri', 'u_sec', 'u_txt', 'u_light'];

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
	const shader = gl.createShader(type);
	if (!shader) return null;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error('[preset-background] shader', gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}
	return shader;
}

/** Null when the browser has no WebGL2: the timer then simply shows the theme background. */
export function createPresetRenderer(canvas: HTMLCanvasElement): PresetRenderer | null {
	let gl: WebGL2RenderingContext | null = null;
	try {
		gl = canvas.getContext('webgl2', {
			alpha: false,
			antialias: false,
			depth: false,
			stencil: false,
			powerPreference: 'low-power',
		}) as WebGL2RenderingContext | null;
	} catch {
		gl = null;
	}
	if (!gl) return null;
	const ctx = gl;

	const buffer = ctx.createBuffer();
	ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer);
	// One triangle that covers the whole screen.
	ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), ctx.STATIC_DRAW);
	const vertex = compileShader(ctx, ctx.VERTEX_SHADER, PRESET_VERTEX_SOURCE);

	const programs = new Map<PresetBackgroundId, Program | null>();

	function programFor(id: PresetBackgroundId): Program | null {
		if (programs.has(id)) return programs.get(id);
		let result: Program | null = null;
		const fragment = vertex ? compileShader(ctx, ctx.FRAGMENT_SHADER, presetFragmentSource(id)) : null;
		if (vertex && fragment) {
			const program = ctx.createProgram();
			ctx.attachShader(program, vertex);
			ctx.attachShader(program, fragment);
			ctx.linkProgram(program);
			ctx.deleteShader(fragment);
			if (ctx.getProgramParameter(program, ctx.LINK_STATUS)) {
				const uniforms: Program['uniforms'] = {};
				for (const name of UNIFORMS) uniforms[name] = ctx.getUniformLocation(program, name);
				result = { program, attrib: ctx.getAttribLocation(program, 'a'), uniforms };
			} else {
				console.error('[preset-background] link', ctx.getProgramInfoLog(program));
				ctx.deleteProgram(program);
			}
		}
		programs.set(id, result);
		return result;
	}

	return {
		draw(id, width, height, time, palette) {
			if (ctx.isContextLost()) return false;
			const p = programFor(id);
			if (!p) return false;
			ctx.viewport(0, 0, width, height);
			ctx.useProgram(p.program);
			ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer);
			ctx.enableVertexAttribArray(p.attrib);
			ctx.vertexAttribPointer(p.attrib, 2, ctx.FLOAT, false, 0, 0);
			ctx.uniform2f(p.uniforms.u_res, width, height);
			ctx.uniform1f(p.uniforms.u_time, time);
			const colours: [string, number[]][] = [
				['u_bg', palette.bg],
				['u_mod', palette.mod],
				['u_pri', palette.pri],
				['u_sec', palette.sec],
				['u_txt', palette.txt],
			];
			for (const [name, [r, g, b]] of colours) ctx.uniform3f(p.uniforms[name], r / 255, g / 255, b / 255);
			ctx.uniform1f(p.uniforms.u_light, palette.light ? 1 : 0);
			ctx.drawArrays(ctx.TRIANGLES, 0, 3);
			return true;
		},
		dispose() {
			if (ctx.isContextLost()) return;
			programs.forEach((p) => p && ctx.deleteProgram(p.program));
			if (vertex) ctx.deleteShader(vertex);
			ctx.deleteBuffer(buffer);
			// Frees the GPU memory now instead of whenever the canvas is collected.
			ctx.getExtension('WEBGL_lose_context')?.loseContext();
		},
	};
}
