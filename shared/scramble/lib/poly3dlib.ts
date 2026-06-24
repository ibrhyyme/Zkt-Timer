/**
 * Polyhedron 3D geometry + puzzle library.
 * Ported from cstimer lib/poly3dlib.js (GPLv3) — https://github.com/cs0x7f/cstimer
 *
 * Provides the geometry primitives (Point/RotTrans/Plane/Sphere/Segment/Arc/Polygon),
 * a generic PolyhedronPuzzle builder (makePuzzle), 2D net projection (renderNet),
 * move parsers, and famous-puzzle presets (getFamousPuzzle) — used by the FTO/Diamond
 * scramble generator (random-state via grouplib) and the 2D net renderer.
 *
 * Color / DOM dependencies from cstimer ($.col2std, kernel.getProp, $.UDPOLY_RE) are
 * removed: getFamousPuzzle returns geometry + parser only; callers supply colors.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const EPS = 1e-6;

export class Point {
	x: number;
	y: number;
	z: number;
	constructor(x: number, y: number, z: number) {
		this.x = x;
		this.y = y;
		this.z = z;
	}
	abs(p?: Point): number {
		return p ? Math.hypot(this.x - p.x, this.y - p.y, this.z - p.z) : Math.hypot(this.x, this.y, this.z);
	}
	add(p: Point, scalar?: number): Point {
		if (scalar === undefined) {
			scalar = 1;
		}
		return new Point(this.x + p.x * scalar, this.y + p.y * scalar, this.z + p.z * scalar);
	}
	scalar(w: number): Point {
		return new Point(this.x * w, this.y * w, this.z * w);
	}
	normalized(): Point {
		const abs = Math.hypot(this.x, this.y, this.z);
		return abs < EPS ? new Point(1, 0, 0) : new Point(this.x / abs, this.y / abs, this.z / abs);
	}
	inprod(p: Point): number {
		return this.x * p.x + this.y * p.y + this.z * p.z;
	}
	outprod(p: Point): Point {
		return new Point(
			this.y * p.z - this.z * p.y,
			this.z * p.x - this.x * p.z,
			this.x * p.y - this.y * p.x
		);
	}
	triangleArea(p1: Point, p2: Point): number {
		const v10x = p1.x - this.x;
		const v10y = p1.y - this.y;
		const v10z = p1.z - this.z;
		const v20x = p2.x - this.x;
		const v20y = p2.y - this.y;
		const v20z = p2.z - this.z;
		return Math.hypot(
			v10y * v20z - v10z * v20y,
			v10z * v20x - v10x * v20z,
			v10x * v20y - v10y * v20x
		) / 2;
	}
}

export class RotTrans {
	mat: number[];
	constructor(norm: Point, theta: number) {
		const c = Math.cos(theta),
			s = Math.sin(theta),
			t = 1 - c,
			x = norm.x,
			y = norm.y,
			z = norm.z,
			tx = t * x,
			ty = t * y;
		this.mat = [
			tx * x + c, tx * y - s * z, tx * z + s * y,
			tx * y + s * z, ty * y + c, ty * z - s * x,
			tx * z - s * y, ty * z + s * x, t * z * z + c
		];
	}
	perform(p: Point): Point {
		const mat = this.mat;
		return new Point(
			mat[0] * p.x + mat[1] * p.y + mat[2] * p.z,
			mat[3] * p.x + mat[4] * p.y + mat[5] * p.z,
			mat[6] * p.x + mat[7] * p.y + mat[8] * p.z
		);
	}
}

// {(x, y, z) | x * norm.x + y * norm.y + z * norm.z = dis}
export class Plane {
	norm: Point;
	dis: number;
	constructor(norm: Point, dis?: number) {
		this.norm = norm;
		this.dis = typeof dis === 'number' ? dis : 1;
	}
	side(point: Point): number {
		return this.norm.inprod(point) - this.dis;
	}
}

export class Sphere {
	ct: Point;
	radius: number;
	norm?: Point;
	constructor(ct: Point, radius: number, norm?: Point) {
		this.ct = ct;
		this.radius = radius;
		if (norm) {
			this.norm = norm;
		}
	}
	side(point: Point): number { // when radius > 0, >0: outside, <0: inside
		return (this.ct.abs(point) - Math.abs(this.radius)) * (this.radius > 0 ? 1 : -1);
	}
}

type Path = Segment | Arc;

export class Segment {
	p1: Point;
	p2: Point;
	ct?: Point;
	norm?: Point;
	constructor(p1: Point, p2: Point) {
		this.p1 = p1;
		this.p2 = p2;
	}
	getMid(): Point {
		return this.p1.add(this.p2).scalar(0.5);
	}
	genMids(): Point[] {
		return [];
	}
	slice(p1: Point, p2: Point): Segment {
		return new Segment(p1, p2);
	}
	revert(): Segment {
		return new Segment(this.p2, this.p1);
	}
	rankKey(p: Point): number {
		return this.p2.add(this.p1, -1).inprod(p);
	}
	intersect(obj: Plane | Sphere): Point[] {
		const ret: Point[] = [];
		if (obj instanceof Plane) {
			const prod1 = this.p1.inprod(obj.norm) - obj.dis;
			const prod2 = this.p2.inprod(obj.norm) - obj.dis;
			if (Math.abs(prod1 - prod2) < EPS) {
				return [];
			}
			const lambda = -prod1 / (prod2 - prod1);
			if (Math.abs(lambda) < EPS || Math.abs(lambda - 1) < EPS) {
				ret.push(Math.abs(lambda) < EPS ? this.p1 : this.p2);
			} else if (lambda > 0 && lambda < 1) {
				ret.push(this.p1.scalar(1 - lambda).add(this.p2, lambda));
			}
		} else if (obj instanceof Sphere) {
			const a = Math.pow(this.p1.abs(this.p2), 2);
			const b = this.p2.add(this.p1, -1).inprod(this.p1.add(obj.ct, -1)) * 2;
			const c = Math.pow(this.p1.abs(obj.ct), 2) - Math.pow(obj.radius, 2);
			const delta = b * b - 4 * a * c;
			if (delta <= 0) { // tangency or not intersected
				return [];
			}
			for (let sign = -1; sign < 2; sign += 2) {
				const lambda = (-b + sign * Math.sqrt(delta)) / (2 * a);
				if (Math.abs(lambda) < EPS || Math.abs(lambda - 1) < EPS) {
					ret.push(Math.abs(lambda) < EPS ? this.p1 : this.p2);
				} else if (lambda > 0 && lambda < 1) {
					ret.push(this.p1.scalar(1 - lambda).add(this.p2, lambda));
				}
			}
		}
		return ret;
	}
}

export class Arc {
	p1: Point;
	p2: Point;
	ct: Point;
	norm: Point;
	_fu: Point;
	_fv: Point;
	_radius: number;
	_ang: number;
	constructor(p1: Point, p2: Point, ct: Point, norm: Point) {
		this.p1 = p1;
		this.p2 = p2;
		this.ct = ct;
		this.norm = norm;
		this._fu = this.p1.add(this.ct, -1).normalized();
		this._fv = this.norm.outprod(this._fu);
		this._radius = this.ct.abs(p1);
		const ctp2 = this.p2.add(this.ct, -1);
		this._ang = (Math.atan2(this._fv.inprod(ctp2), this._fu.inprod(ctp2)) + Math.PI * 2 + EPS) % (Math.PI * 2) - EPS;
	}
	getMid(): Point {
		return this.ct.add(this._fu, Math.cos(this._ang / 2) * this._radius).add(this._fv, Math.sin(this._ang / 2) * this._radius);
	}
	genMids(): Point[] {
		const nSegs = Math.ceil(this._ang / Math.PI * 180 / 10);
		const mids: Point[] = [];
		for (let i = 0; i < nSegs - 1; i++) {
			const theta = this._ang / nSegs * (i + 1);
			mids.push(this.ct.add(this._fu, Math.cos(theta) * this._radius).add(this._fv, Math.sin(theta) * this._radius));
		}
		return mids;
	}
	slice(p1: Point, p2: Point): Arc {
		return new Arc(p1, p2, this.ct, this.norm);
	}
	revert(): Arc {
		return new Arc(this.p2, this.p1, this.ct, this.norm.scalar(-1));
	}
	rankKey(p: Point): number {
		const vec1 = p.add(this.ct, -1);
		return Math.atan2(this._fv.inprod(vec1), this._fu.inprod(vec1));
	}
	intersect(obj: Plane | Sphere): Point[] {
		let a = 0, b = 0, c = 0;
		// p = ct + radius * (fu * cos(t) + fv * sin(t)), 0 <= t <= atan2(<p2 - ct , fv>, <p2 - ct, fu>);
		if (obj instanceof Plane) {
			a = this._radius * obj.norm.inprod(this._fv);
			b = this._radius * obj.norm.inprod(this._fu);
			c = obj.dis - obj.norm.inprod(this.ct);
		} else if (obj instanceof Sphere) {
			const vec1 = this.ct.add(obj.ct, -1);
			a = this._radius * vec1.inprod(this._fv);
			b = this._radius * vec1.inprod(this._fu);
			c = ((obj.radius + this._radius) * (obj.radius - this._radius) - Math.pow(this.ct.abs(obj.ct), 2)) / 2;
		}
		// solve: b cos(t) + a sin(t) = c => sqrt(a*a+b*b) cos(t + phi) = c, phi = atan2(-a, b)
		const phi = Math.atan2(-a, b);
		const cos_t = c / Math.hypot(a, b);
		if (Math.abs(cos_t) >= 1) { // tangency or not intersected
			return [];
		}
		const ret: any[] = [];
		const t0 = Math.acos(cos_t);
		for (let sign = -1; sign < 2; sign += 2) {
			const t = (sign * t0 - phi + Math.PI * 4 + EPS) % (Math.PI * 2) - EPS;
			if (t > -EPS && t < this._ang + EPS) {
				ret.push(t);
			}
		}
		ret.sort(function(a2, b2) { return a2 - b2; });
		for (let i = 0; i < ret.length; i++) {
			if (Math.abs(ret[i]) < EPS || Math.abs(ret[i] - this._ang) < EPS) {
				ret[i] = Math.abs(ret[i]) < EPS ? this.p1 : this.p2;
			} else {
				ret[i] = this.ct.add(this._fu, Math.cos(ret[i]) * this._radius).add(this._fv, Math.sin(ret[i]) * this._radius);
			}
		}
		return ret as Point[];
	}
}

// assert points.length >= 3, assume paths[i].p2 = paths[i + ].p1
export class Polygon {
	paths: Path[];
	area: number;
	center!: Point;
	norm!: Point;
	dis!: number;
	constructor(paths: Path[]) {
		this.paths = paths.slice();
		let norm: Point | undefined;
		for (let i = 0; i < paths.length; i++) {
			if ((paths[i] as Arc).ct) {
				norm = (paths[i] as Arc).norm;
				break;
			}
			const candNorm = paths[0].p2.add(paths[0].p1, -1).outprod(paths[1].p2.add(paths[1].p1, -1));
			if (candNorm.abs() > EPS * 10) {
				norm = candNorm.normalized();
				break;
			}
		}
		this.area = 0;
		if (!norm) {
			return;
		}
		let center = new Point(0, 0, 0);
		for (let i = 1; i < paths.length - 1; i++) {
			const area = paths[i].p1.add(paths[0].p1, -1).outprod(paths[i].p2.add(paths[i].p1, -1)).inprod(norm) / 2;
			center = center.add(paths[0].p1, area / 3);
			center = center.add(paths[i].p1, area / 3);
			center = center.add(paths[i].p2, area / 3);
			this.area += area;
		}
		for (let i = 0; i < paths.length; i++) {
			if (!(paths[i] as Arc).ct) {
				continue;
			}
			const arc = paths[i] as Arc;
			const h = 4 * arc._radius * Math.pow(Math.sin(arc._ang / 2), 3) / 3 / (arc._ang - Math.sin(arc._ang));
			const area = Math.pow(arc._radius, 2) * (arc._ang - Math.sin(arc._ang)) / 2 * arc.norm.inprod(norm);
			const centroid = arc.ct.add(arc.norm.outprod(arc.p2.add(arc.p1, -1)).normalized(), -h);
			center = center.add(centroid, area);
			this.area += area;
		}
		this.center = center.scalar(1 / this.area);
		this.norm = this.area > 0 ? norm : norm.scalar(-1);
		this.area = Math.abs(this.area);
		this.dis = this.norm.inprod(paths[0].p1);
	}

	static fromVertices(vertices: Point[]): Polygon {
		const paths: Path[] = [];
		for (let i = 0; i < vertices.length; i++) {
			paths.push(new Segment(vertices[i], vertices[(i + 1) % vertices.length]));
		}
		return new Polygon(paths);
	}

	projection(norms: Point[]): number[][] {
		const ret: number[][] = [];
		for (let i = 0; i < this.paths.length; i++) {
			const points = [this.paths[i].p1].concat(this.paths[i].genMids());
			for (let k = 0; k < points.length; k++) {
				const coord: number[] = [];
				for (let j = 0; j < norms.length; j++) {
					coord.push(points[k].inprod(norms[j]));
				}
				ret.push(coord);
			}
		}
		return ret;
	}

	split(obj: Plane | Sphere): Polygon[][] {
		// calculate all intersects
		const paths: Path[][] = [[], []];
		let nCuts = 0;
		const refSide = obj.side(this.center) < 0 ? 1 : 0; // 0 outside, 1 inside
		for (let i = 0; i < this.paths.length; i++) {
			const path = this.paths[i];
			const points = path.intersect(obj);
			nCuts += points.length;
			let start = path.p1;
			for (let j = 0; j < points.length; j++) {
				if (start.abs(points[j]) > EPS) {
					const newPath = path.slice(start, points[j]);
					paths[obj.side(newPath.getMid()) < 0 ? 1 : 0].push(newPath);
					start = points[j];
				}
			}
			if (start.abs(path.p2) > EPS) {
				const remainPath = start == path.p1 ? path : path.slice(start, path.p2);
				const sideFloat = obj.side(remainPath.getMid());
				paths[Math.abs(sideFloat) < EPS ? refSide : sideFloat < 0 ? 1 : 0].push(remainPath);
			}
		}

		let cutBound: Path;
		if (obj instanceof Plane) {
			if (nCuts == 0) {
				return paths[0].length == 0 ? [[], [this]] : [[this], []];
			}
			cutBound = new Segment(new Point(0, 0, 0), obj.norm.outprod(this.norm));
		} else {
			const ct = obj.ct.add(this.norm, -this.norm.inprod(obj.ct) + this.dis);
			let radius = Math.pow(obj.radius, 2) - Math.pow(this.dis - this.norm.inprod(obj.ct), 2);
			if (radius <= 0) {
				return paths[0].length == 0 ? [[], [this]] : [[this], []];
			}
			radius = Math.sqrt(radius);
			const p1 = this.paths[1].p1.add(this.paths[0].p1, -1).normalized().scalar(radius).add(ct);
			cutBound = new Arc(p1, p1, ct, this.norm.scalar(obj.radius > 0 ? -1 : 1));
		}

		const polys: Polygon[][] = [[], []];

		for (let side = 0; side < 2; side++) {
			// mark all near-bound points
			const pathStart: any[] = [];
			const pathsSide = paths[side];
			const len = pathsSide.length;
			for (let i = 0; i < len; i++) {
				const nextIdx = (i + 1) % len;
				if (pathsSide[i].p2.abs(pathsSide[nextIdx].p1) > EPS) {
					pathStart.push([nextIdx, cutBound.rankKey(pathsSide[nextIdx].p1), pathsSide[nextIdx].p1]);
				}
			}
			pathStart.sort((a, b) => a[1] - b[1]);
			let usedCnt = 0;
			const used: number[] = [];
			while (usedCnt < pathsSide.length) {
				const curPaths: Path[] = [];
				let idx = 0;
				while (used[idx]) {
					idx++;
				}
				while (true) {
					const path = pathsSide[idx];
					curPaths.push(path);
					used[idx] = 1;
					usedCnt++;
					if (path.p2.abs(curPaths[0].p1) < EPS) { // close path
						break;
					}
					idx = (idx + 1) % len;
					if (path.p2.abs(pathsSide[idx].p1) < EPS) {
						continue;
					}
					const key = cutBound.rankKey(path.p2);
					let next = 0;
					for (let i = 0; i < pathStart.length; i++) {
						if (pathStart[i][1] > key) {
							next = i;
							break;
						}
					}
					idx = pathStart[next][0];
					pathStart.splice(next, 1);
					curPaths.push(cutBound.slice(path.p2, pathsSide[idx].p1));
					if (pathsSide[idx].p1.abs(curPaths[0].p1) < EPS) { // close path
						break;
					}
				}
				const poly = new Polygon(curPaths);
				if (poly.area > EPS) {
					polys[side].push(poly);
				}
			}
			cutBound = cutBound.revert();
		}
		return polys;
	}

	trim(gap: number): Polygon | null {
		let poly: Polygon | null = this;
		for (let i = 0; i < this.paths.length; i++) { // check paths[i]
			const path = this.paths[i];
			if (path instanceof Arc) {
				const radius = (this.norm.inprod(path.norm) > 0 ? 1 : -1) * path._radius;
				poly = poly.split(new Sphere(path.ct, radius - gap / 2))[1][0];
			} else {
				const norm = path.p2.add(path.p1, -1).outprod(this.norm).normalized();
				const dis = norm.inprod(path.p2);
				poly = poly.split(new Plane(norm, dis - gap / 2))[1][0];
			}
			if (!poly) {
				return null;
			}
		}
		return poly;
	}
}

// facePlanes = [plane1, plane2, ..., planeN]
export class PolyhedronPuzzle {
	facePlanes: Plane[];
	faceNames: string[];
	faceUVs: Point[][];
	facesPolys!: Polygon[][];
	twistyPlanes!: (Plane | Sphere)[];
	twistyDetails!: any[][];
	_twistyCache!: Record<string, number>;
	moveTable!: number[][];

	constructor(facePlanes: Plane[], faceVs: Point[], faceNames: string[]) {
		this.facePlanes = facePlanes.slice();
		this.faceNames = faceNames.slice();
		this.faceUVs = [];
		for (let i = 0; i < facePlanes.length; i++) {
			const faceNorm = facePlanes[i].norm;
			let faceV = faceVs[i];
			faceV = faceV.add(faceNorm, -faceV.inprod(faceNorm)).normalized();
			const faceU = faceV.outprod(faceNorm);
			this.faceUVs[i] = [faceU, faceV];
		}
		this.makeFacePolygons();
	}

	// twistyPlanes = [plane1, plane2, ..., planeN]
	// twistyDetails = [[name1, maxPow1, planeIdx1_1, planeIdx1_2, ...], ...]
	setTwisty(twistyPlanes: (Plane | Sphere)[], twistyDetails: any[][]): void {
		this.twistyPlanes = twistyPlanes.slice();
		this.twistyDetails = twistyDetails.slice();
		this._twistyCache = {};
		for (let i = 0; i < twistyDetails.length; i++) {
			if (this.twistyDetails[i].length == 2) {
				this.twistyDetails[i].push(i);
			}
		}
		this.cutFacePolygons();
		this.makeMoveTable();
	}

	getTwistyIdx(laxis: string): number {
		if (laxis in this._twistyCache) {
			return this._twistyCache[laxis];
		}
		const m = /^(\d*)([A-Z][A-Za-z]*)$/.exec(laxis);
		if (!m) {
			return -1;
		}
		const layerRe = new RegExp(m[1] + "(?=[A-Z])");
		const axis = m[2].split(/(?=[A-Z])/g);
		const faceSet: Record<string, RegExp> = {};
		let faceCnt = 0;
		for (let i = 0; i < axis.length; i++) {
			if (faceSet[axis[i]] == undefined) {
				faceSet[axis[i]] = new RegExp(axis[i] + "(?=[A-Z]|$)");
				faceCnt++;
			}
		}
		let minRemain: [number, number] = [99, -1];
		for (let i = 0; i < this.twistyDetails.length; i++) {
			const chkAxis = this.twistyDetails[i][0];
			if (!layerRe.exec(chkAxis)) {
				continue;
			}
			let remain = chkAxis.length - m[1].length;
			for (const face in faceSet) {
				if (faceSet[face].exec(chkAxis)) {
					remain -= face.length;
				} else {
					remain = 99;
					break;
				}
			}
			if (remain < minRemain[0]) {
				minRemain = [remain, i];
			}
		}
		this._twistyCache[laxis] = faceCnt == 1 && minRemain[0] != 0 ? -1 : minRemain[1];
		return this._twistyCache[laxis];
	}

	makeFacePolygons(): void {
		this.facesPolys = [];
		for (let face = 0; face < this.facePlanes.length; face++) {
			const norm = this.facePlanes[face].norm;
			const dis = this.facePlanes[face].dis;
			const faceCenter = norm.scalar(dis);
			const faceUV = this.faceUVs[face];
			let poly: Polygon | null = Polygon.fromVertices([
				faceCenter.add(faceUV[0], 100),
				faceCenter.add(faceUV[1], 100),
				faceCenter.add(faceUV[0], -100),
				faceCenter.add(faceUV[1], -100)
			]);
			for (let fother = 0; fother < this.facePlanes.length; fother++) {
				if (fother == face) {
					continue;
				}
				poly = poly!.split(this.facePlanes[fother])[1][0];
				if (!poly) { // all area in the plane is cut out, input is incorrect
					break;
				}
			}
			this.facesPolys[face] = [poly!];
		}
	}

	cutFacePolygons(): void {
		const cuts = this.twistyPlanes.slice();
		cuts.sort(function(a, b) { return ((a as Sphere).ct ? 1 : 0) - ((b as Sphere).ct ? 1 : 0); });
		// TODO we are not able to handle holes, so cut plane first
		for (let i = 0; i < cuts.length; i++) {
			const plane = cuts[i];
			this.enumFacesPolys((face, p, poly) => {
				let polys = poly.split(plane);
				const flat = Array.prototype.concat.apply([], polys);
				this.facesPolys[face][p] = flat[0];
				for (let j = 1; j < flat.length; j++) {
					this.facesPolys[face].push(flat[j]);
				}
				return false;
			});
		}
	}

	enumFacesPolys(callback: (face: number, p: number, poly: Polygon, idx: number) => boolean | void): void {
		let idx = 0;
		for (let face = 0; face < this.facesPolys.length; face++) {
			const facePolys = this.facesPolys[face];
			const polyLen = facePolys.length;
			for (let p = 0; p < polyLen; p++) {
				if (callback(face, p, facePolys[p], idx)) {
					return;
				}
				idx++;
			}
		}
	}

	makeMoveTable(): void {
		this.moveTable = [];
		const proj1d: any[] = [];
		const projNorm = new Point(1, 2, 3).normalized();
		this.enumFacesPolys((face, p, poly, idx) => {
			proj1d[idx] = [idx, projNorm.inprod(poly.center), poly.center];
		});
		proj1d.sort(function(a, b) { return a[1] - b[1]; });
		for (let i = 0; i < this.twistyDetails.length; i++) {
			const curMove: number[] = [];
			const planes: (Plane | Sphere)[] = [];
			for (let j = 2; j < this.twistyDetails[i].length; j++) {
				planes.push(this.twistyPlanes[this.twistyDetails[i][j]]);
			}
			const trans = new RotTrans(planes[0].norm!, Math.PI * 2 / this.twistyDetails[i][1]);
			this.enumFacesPolys((face, p, poly, idx) => {
				for (let j = 0; j < planes.length; j++) {
					if (planes[j].side(poly.center) < 0) {
						curMove[idx] = -1; // not affect by this twisty
						return;
					}
				}
				const movedCenter = trans.perform(poly.center);
				const movedProj = projNorm.inprod(movedCenter);
				let left = 0, right = proj1d.length - 1;
				while (right > left) {
					const mid = (right + left) >> 1;
					const midval = proj1d[mid][1];
					if (midval < movedProj - EPS) {
						left = mid + 1;
					} else {
						right = mid;
					}
				}
				for (let j = left; j < proj1d.length; j++) {
					if (movedCenter.abs(proj1d[j][2]) < EPS) {
						curMove[idx] = proj1d[j][0];
						break;
					}
				}
			});
			this.moveTable.push(curMove);
		}
	}
}

export function makePuzzle(
	nface: number, faceCuts: any[], edgeCuts: any[], cornCuts: any[],
	faceMoves?: any[], edgeMoves?: any[], cornMoves?: any[]
): PolyhedronPuzzle {
	let faceNorms: Point[] = [];
	let faceVs: any[] = [];
	let faceNames: string[] = [];
	let facePow = 3;
	const edgePow = 2;
	let cornPow = 3;
	if (nface == 4) { // tetrahedron
		faceNorms = [
			new Point(0, -1, 0),
			new Point(-Math.sqrt(6) / 3, 1 / 3, -Math.sqrt(2) / 3),
			new Point(Math.sqrt(6) / 3, 1 / 3, -Math.sqrt(2) / 3),
			new Point(0, 1 / 3, Math.sqrt(8) / 3)
		];
		faceVs = [3, 2, 1, new Point(0, 1, 0)];
		faceNames = ["D", "L", "R", "F"];
	} else if (nface == 6) { // cube
		faceNorms = [
			new Point(0, 1, 0),
			new Point(1, 0, 0),
			new Point(0, 0, 1)
		];
		faceVs = [5, 0, 0, 2, 0, 0];
		faceNames = ["U", "R", "F", "D", "L", "B"];
		facePow = 4;
	} else if (nface == 8) { // octahedron
		faceNorms = [
			new Point(0, 1, 0),
			new Point(Math.sqrt(6) / 3, 1 / 3, Math.sqrt(2) / 3),
			new Point(-Math.sqrt(6) / 3, 1 / 3, Math.sqrt(2) / 3),
			new Point(0, -1 / 3, Math.sqrt(8) / 3)
		];
		const UBEdge = faceNorms[0].add(faceNorms[3], -1);
		faceVs = [7, UBEdge, UBEdge, 0, 7, UBEdge, UBEdge, 0];
		faceNames = ["U", "R", "L", "F", "D", "Bl", "Br", "B"];
		cornPow = 4;
	} else if (nface == 12) { // dodecahedron
		faceNorms = [
			new Point(0, Math.sqrt(5), 0)
		];
		for (let i = 0; i < 5; i++) {
			faceNorms.push(new Point(2 * Math.sin(0.4 * i * Math.PI), 1, 2 * Math.cos(0.4 * i * Math.PI)));
		}
		faceVs = [7, 0, 3, 7, 7, 4, 7, 0, 3, 7, 7, 4];
		faceNames = ["U", "F", "R", "Br", "Bl", "L", "D", "B", "Dbl", "Dl", "Dr", "Dbr"];
		facePow = 5;
	} else if (nface == 20) { // icosahedron
		for (let i = 0; i < 5; i++) {
			const r1 = Math.sqrt(5) + 1;
			const r2 = Math.sqrt(5) + 3;
			faceNorms.push(new Point(r1 * Math.sin(0.4 * i * Math.PI), Math.sqrt(5) + 2, r1 * Math.cos(0.4 * i * Math.PI)));
			faceNorms.push(new Point(r2 * Math.sin(0.4 * i * Math.PI), 1, r2 * Math.cos(0.4 * i * Math.PI)));
			faceVs[i * 2] = i * 2 + 11;
			faceVs[i * 2 + 1] = i * 2;
			faceVs[i * 2 + 10] = i * 2 + 11;
			faceVs[i * 2 + 11] = i * 2;
		}
		faceNames = ["U", "F", "Ur", "R", "Ubr", "Br", "Ubl", "Bl", "Ul", "L", "D", "B", "Dl", "Lb", "Dfl", "Fl", "Dfr", "Fr", "Dr", "Rb"];
		cornPow = 5;
	}
	if (nface != 4) {
		for (let i = 0, length = faceNorms.length; i < length; i++) {
			faceNorms[i] = faceNorms[i].normalized();
			faceNorms.push(faceNorms[i].scalar(-1));
		}
	}

	const facePlanes: Plane[] = [];
	for (let i = 0; i < faceNorms.length; i++) {
		facePlanes.push(new Plane(faceNorms[i]));
		if (typeof faceVs[i] == 'number') {
			faceVs[i] = faceNorms[faceVs[i]];
		}
	}

	const puzzle = new PolyhedronPuzzle(facePlanes, faceVs, faceNames);

	const twistyPlanes: (Plane | Sphere)[] = [];
	const twistyDetails: any[][] = [];

	function addAxes(norms: Point[], names: string[], pow: number, cuts: any[], moves?: any[]): void {
		if (!cuts || cuts.length == 0) {
			return;
		}
		if (!moves) {
			moves = [];
			for (let i = 0; i < cuts.length; i++) {
				moves[i] = i;
			}
		}
		for (let i = 0; i < norms.length; i++) {
			const planeBase = twistyPlanes.length;
			for (let j = 0; j < cuts.length; j++) {
				if (typeof cuts[j] == 'number') { // plane
					twistyPlanes.push(new Plane(norms[i], cuts[j]));
				} else { // sphere
					twistyPlanes.push(new Sphere(norms[i].scalar(cuts[j][0]), cuts[j][1], norms[i]));
				}
			}
			for (let j = 0; j < moves.length; j++) {
				const detail: any[] = [j + "" + names[i], pow];
				const planes = typeof moves[j] == 'number' ? [moves[j]] : moves[j];
				for (let k = 0; k < planes.length; k++) {
					detail.push(planes[k] + planeBase);
				}
				twistyDetails.push(detail);
			}
		}
	}

	addAxes(faceNorms, faceNames, facePow, faceCuts, faceMoves);

	if (edgeCuts && edgeCuts.length > 0) {
		const edgeNorms: Point[] = [];
		const edgeNames: string[] = [];
		puzzle.enumFacesPolys(function(face, p, poly) {
			let _point = poly.paths.at(-1)!.p1;
			for (let i = 0; i < poly.paths.length; i++) {
				const point = poly.paths[i].p1;
				let edgeNorm: Point | null = point.add(_point).normalized();
				for (let j = 0; j < edgeNorms.length; j++) {
					if (edgeNorm.abs(edgeNorms[j]) < EPS) {
						edgeNames[j] += faceNames[face];
						edgeNorm = null;
						break;
					}
				}
				if (edgeNorm) {
					edgeNorms.push(edgeNorm);
					edgeNames.push(faceNames[face]);
				}
				_point = point;
			}
		});
		addAxes(edgeNorms, edgeNames, edgePow, edgeCuts, edgeMoves);
	}
	if (cornCuts && cornCuts.length > 0) {
		const cornNorms: Point[] = [];
		const cornNames: string[] = [];
		puzzle.enumFacesPolys(function(face, p, poly) {
			for (let i = 0; i < poly.paths.length; i++) {
				let cornNorm: Point | null = poly.paths[i].p1.normalized();
				for (let j = 0; j < cornNorms.length; j++) {
					if (cornNorm.abs(cornNorms[j]) < EPS) {
						cornNames[j] += faceNames[face];
						cornNorm = null;
						break;
					}
				}
				if (cornNorm) {
					cornNorms.push(cornNorm);
					cornNames.push(faceNames[face]);
				}
			}
		});
		addAxes(cornNorms, cornNames, cornPow, cornCuts, cornMoves);
	}

	puzzle.setTwisty(twistyPlanes, twistyDetails);

	return puzzle;
}

// return [sizes, polys, faceMeta], polys = [ [xs, ys, face], ... ]
export function renderNet(puzzle: PolyhedronPuzzle, gap?: number, minArea?: number): [number[], any[], any[]] {
	let faceTrans: number[][] = [];
	const nface = puzzle.facePlanes.length;
	gap = gap || 0;
	minArea = minArea || 0;
	let sizes: number[] = [0, 0];
	if (nface == 4) { // tetrahedron
		const hw = Math.sqrt(6) * (1 + gap);
		const hwdsq3 = hw / Math.sqrt(3);
		faceTrans = [
			[hw * 2, hwdsq3 * 4], [hw * 1, hwdsq3 * 1],
			[hw * 3, hwdsq3 * 1], [hw * 2, hwdsq3 * 2]
		];
		sizes = [hw * 4, hwdsq3 * 6];
	} else if (nface == 6) { // cube
		const hw = (1 + gap);
		faceTrans = [
			[hw * 3, hw], [hw * 5, hw * 3], [hw * 3, hw * 3],
			[hw * 3, hw * 5], [hw, hw * 3], [hw * 7, hw * 3]
		];
		sizes = [hw * 8, hw * 6];
	} else if (nface == 8) { // octahedron
		const hwdsq3 = Math.sqrt(6) * (1 + gap) / 2 / Math.sqrt(3);
		const sq3 = Math.sqrt(3);
		faceTrans = [
			[hwdsq3 * 3, hwdsq3 * 1, sq3, 1], [hwdsq3 * 5, hwdsq3 * 3, 1, sq3],
			[hwdsq3 * 1, hwdsq3 * 3, 1, sq3], [hwdsq3 * 3, hwdsq3 * 5, sq3, 1],
			[hwdsq3 * 9, hwdsq3 * 5, sq3, 1], [hwdsq3 * 11, hwdsq3 * 3, 1, sq3],
			[hwdsq3 * 7, hwdsq3 * 3, 1, sq3], [hwdsq3 * 9, hwdsq3 * 1, sq3, 1]
		];
		sizes = [hwdsq3 * 12, hwdsq3 * 6];
	} else if (nface == 12) { // dodecahedron
		const phi = (Math.sqrt(5) + 1) / 2;
		const hw = Math.sqrt(3 - phi) / Math.pow(phi, 2) * (1 + gap);
		const wec2 = hw * Math.tan(Math.PI * 0.3) * 2;
		const off1X = hw * (1 + 2 * phi);
		const off1Y = hw * (1 / Math.sin(Math.PI * 0.2) + Math.cos(Math.PI * 0.1) * 2);
		const off2X = hw * (4 + 5 * phi);
		const off2Y = wec2 + hw / Math.cos(Math.PI * 0.3);
		faceTrans[0] = [off1X, off1Y];
		faceTrans[6] = [off2X, off2Y];
		for (let i = 0; i < 5; i++) {
			faceTrans[1 + i] = [off1X + Math.cos(Math.PI * (0.5 - 0.4 * i)) * wec2, off1Y + Math.sin(Math.PI * (0.5 - 0.4 * i)) * wec2];
			faceTrans[7 + i] = [off2X + Math.cos(Math.PI * (1.5 + 0.4 * i)) * wec2, off2Y + Math.sin(Math.PI * (1.5 + 0.4 * i)) * wec2];
		}
		sizes = [off1X + off2X, off1Y + off2Y];
	} else if (nface == 20) { // icosahedron
		const phi = (Math.sqrt(5) + 1) / 2;
		const hw = Math.sqrt(3) / Math.pow(phi, 2) * (1 + gap);
		for (let i = 0; i < 5; i++) {
			faceTrans[i * 2] = [((5 + i * 2) % 10 + 1) * hw, 2 * hw / Math.sqrt(3)];
			faceTrans[i * 2 + 1] = [((5 + i * 2) % 10 + 1) * hw, 4 * hw / Math.sqrt(3)];
			faceTrans[i * 2 + 10] = [(1 + i * 2) % 10 * hw, 7 * hw / Math.sqrt(3)];
			faceTrans[i * 2 + 11] = [(1 + i * 2) % 10 * hw, 5 * hw / Math.sqrt(3)];
		}
		sizes = [hw * 11, 9 * hw / Math.sqrt(3)];
	}
	const ret: any[] = [];
	const faceMeta: any[] = [];
	puzzle.enumFacesPolys(function(face, p, poly, idx) {
		if (poly.area < minArea!) {
			return;
		}
		const cords = poly.projection(puzzle.faceUVs[face]);
		const trans = faceTrans[face];
		const arr: any[] = [[], []];
		for (let i = 0; i < cords.length; i++) {
			arr[0][i] = trans[0] + cords[i][0] * (trans[2] || 1);
			arr[1][i] = trans[1] - cords[i][1] * (trans[3] || 1);
		}
		arr[2] = face;
		ret[idx] = arr;
		faceMeta[face] = faceMeta[face] || [trans[0], trans[1], puzzle.faceNames[face]];
	});
	return [sizes, ret, faceMeta];
}

// parseFunc(m, p1, p2, ..) -> [layer, axis, pow] or null, toStrFunc(layer:int, axis:str, pow:int) -> moveString
export function makeParser(
	regexp: RegExp,
	parseFunc: (...args: any[]) => any,
	toStrFunc: (layer: number, axis: string, pow: number) => string,
	preProcess?: (scramble: string) => string
): { parseScramble: (scramble: string) => any[]; move2str: (move: any[]) => string } {
	return {
		parseScramble: function(scramble: string): any[] {
			if (!scramble || /^\s*$/.exec(scramble)) {
				return [];
			}
			if (preProcess) {
				scramble = preProcess(scramble);
			}
			const ret: any[] = [];
			scramble.replace(regexp, function(this: any) {
				const move = parseFunc.apply(null, arguments as any);
				if (move) {
					ret.push(["" + move[0] + move[1], move[2]]);
				}
				return '';
			});
			return ret;
		},
		move2str: function(move: any[]): string {
			const m = /^(\d+)([a-zA-Z]+)$/.exec(move[0]);
			if (!m) { // invalid move
				return "";
			}
			return toStrFunc(~~m[1], m[2], move[1]);
		}
	};
}

export function makePuzzleParser(puzzle: PolyhedronPuzzle) {
	return makeParser(/(?:^|\s*)(?:\[([a-zA-Z]+)(\d*)(')?\]|(\d*)([A-Z][a-zA-Z]*)(\d*)(')?)(?:$|\s*)/g, function(m, p1, p2, p3, p4, p5, p6, p7) {
		const layer = p1 ? '0' : p4 == '' ? '1' : p4;
		const axis = p1 || p5;
		const pow = (p1 ? (p2 == '' ? 1 : ~~p2) : (p6 == '' ? 1 : ~~p6)) * ((p3 || p7) ? -1 : 1);
		if (puzzle.getTwistyIdx(layer + axis) != -1) {
			return [layer, axis, pow];
		}
	}, function(layer, axis, pow) {
		const move = axis + (Math.abs(pow) == 1 ? "" : Math.abs(pow)) + (pow < 0 ? "'" : "");
		return layer == 0 ? ('[' + move + ']') : move;
	});
}

export function parsePolyParam(polyDef: string): any[] {
	const paramCmd = polyDef.split(/\s+/g);
	const nFace = [4, 6, 8, 12, 20]['tcodi'.indexOf(paramCmd[0])];
	const polyParam: any[] = [nFace, [-5], [-5], [-5]];
	let cutIdx = 1;
	for (let i = 1; i < paramCmd.length; i++) {
		if (/^[fev]$/.exec(paramCmd[i])) {
			cutIdx = ' fev'.indexOf(paramCmd[i]);
		} else if (/^[+-]?\d+(?:\.\d+)?$/.exec(paramCmd[i])) {
			polyParam[cutIdx].push(parseFloat(paramCmd[i]));
		} else if (/^\d+(?:\.\d+)?r[+-]?\d+(?:\.\d+)?$/.exec(paramCmd[i])) {
			const sphereCmd = paramCmd[i].split('r');
			polyParam[cutIdx].push([parseFloat(sphereCmd[0]), -parseFloat(sphereCmd[1])]);
		}
	}
	return polyParam;
}

export interface FamousPuzzle {
	parser?: ReturnType<typeof makeParser>;
	polyParam: any[];
	scale: number;
	pieceGap: number;
	colors: number[];
}

// FTO face colors (cstimer colfto `#fff#808#0d0#f00#00f#bbb#ff0#fa0` mapped via faceMap
// [0,3,1,2,6,7,5,4]) — order matches octahedron face planes [U,R,L,F,D,Bl,Br,B].
const FTO_COLORS = [0xffffff, 0xff0000, 0x880088, 0x00dd00, 0xffff00, 0xffaa00, 0xbbbbbb, 0x0000ff];

export function getFamousPuzzle(name: string): FamousPuzzle | null {
	let polyParam: any[] | undefined;
	let parser: ReturnType<typeof makeParser> | undefined;
	let scale = 1;
	let pieceGap = 0.075;
	let colors: number[] = [];
	if (/^(\d)\1\1$/.exec(name)) {
		const dimM = /^(\d)\1\1$/.exec(name)!;
		const dim = ~~dimM[1];
		polyParam = [6, [-5]];
		for (let i = 0; i < (dim >> 1); i++) {
			polyParam[1].push(1 - (i + 1) * 2 / dim);
		}
	} else if (name == "pyr" || name == "mpyr") {
		polyParam = [4, [], [], {
			"pyr": [-5, 5 / 3, 1 / 3],
			"mpyr": [-5, 2, 1, 0]
		}[name]];
		scale = 0.51;
		pieceGap = 0.14;
		parser = makeParser(/(?:^|\s*)(?:([URLBurlb])(w?)(')?|\[([urlb])(')?\])(?:$|\s*)/g, function(m, p1, p2, p3, p4, p5) {
			const face = ["LRF", "DRF", "DLF", "DLR"]["URLB".indexOf((p1 || p4).toUpperCase())];
			return [p4 ? 0 : p2 ? 3 : p1 == p1.toUpperCase() ? 2 : 1, face, (p3 || p5) ? -1 : 1];
		}, function(layer, axis, pow) {
			const move = "urlb".charAt(["LRF", "DRF", "DLF", "DLR"].indexOf(axis));
			const powfix = pow < 0 ? "'" : "";
			return ["[" + move + powfix + "]", move + powfix, move.toUpperCase() + powfix, move.toUpperCase() + 'w' + powfix][layer];
		});
	} else if (name == "fto" || name == "dmd") {
		polyParam = {
			"fto": [8, [-5, 1 / 3, -1 / 3], [], [-5]],
			"dmd": [8, [-5, 0], [], [-5]]
		}[name];
		parser = makeParser(/(?:^|\s*)\[?([URFDLT]|(?:B[RL]?))(w)?(')?(\])?(?:$|\s*)/g, function(m, p1, p2, p3, p4) {
			return [p4 || p1 == 'T' ? 0 : p2 ? 2 : 1, p1 == 'T' ? 'URLF' : (p1[0] + p1.slice(1).toLowerCase()), p3 ? -1 : 1];
		}, function(layer, axis, pow) {
			const move = (axis.length > 3 ? 'T' : axis.toUpperCase()) + (layer == 2 ? 'w' : '') + (pow > 0 ? "" : "'");
			return layer == 0 ? ('[' + move + ']') : move;
		});
	} else if (name == "klm" || name == "mgm" || name == "prc" || name == "giga") {
		polyParam = [12, {
			"klm": [-5, 0.57, -0.57],
			"mgm": [-5, 0.72, -0.72],
			"giga": [-5, 0.83, -0.83, 0.66, -0.66],
			"prc": [-5, 0.4472136, -0.4472136]
		}[name]];
		scale = 1.18;
		pieceGap = 0.05;
	} else if (name == 'ctico') {
		polyParam = [20, [], [], [-5, 0]];
	} else {
		return null;
	}
	const nFace = polyParam![0];
	if (nFace == 8) {
		colors = FTO_COLORS.slice();
	}

	return {
		parser,
		polyParam: polyParam!,
		scale,
		pieceGap,
		colors
	};
}
