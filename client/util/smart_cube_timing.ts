/**
 * Smart Cube Zamanlama Düzeltme Utility
 *
 * cstimer tsLinearFix() ve gan-cube-sample cubeTimestampLinearFit() referans alınarak
 * per-solve post-solve linear regression ile doğru zamanlama hesaplar.
 */

export interface TimestampedMove {
	turn: string;
	completedAt: number;
	cubeTimestamp: number | null;
	localTimestamp: number | null;
}

export interface CorrectedMove extends TimestampedMove {
	completedAt: number;
}

export interface LinearFitResult {
	correctedMoves: CorrectedMove[];
	finalTimeMs: number;
}

/**
 * En küçük kareler (least squares) linear regression: y = slope * x + intercept
 * gan.js:14-29 ile aynı algoritma, TypeScript versiyonu.
 */
function linregress(xs: number[], ys: number[]): [number, number] {
	const n = xs.length;
	if (n < 2) return [1, 0];

	let sumX = 0;
	let sumY = 0;
	let sumXY = 0;
	let sumX2 = 0;

	for (let i = 0; i < n; i++) {
		sumX += xs[i];
		sumY += ys[i];
		sumXY += xs[i] * ys[i];
		sumX2 += xs[i] * xs[i];
	}

	const denom = n * sumX2 - sumX * sumX;
	if (denom === 0) return [1, 0];

	const slope = (n * sumXY - sumX * sumY) / denom;
	const intercept = (sumY - slope * sumX) / n;
	return [slope, intercept];
}

/**
 * Post-solve timestamp düzeltmesi: per-solve linear fit.
 *
 * Algoritma (cstimer tsLinearFix / gan-cube-sample cubeTimestampLinearFit ile aynı):
 * 1. Kaçan hamlelerin null timestamp'lerini interpolate et (±50ms)
 * 2. Çözüm hamlelerinin (cubeTimestamp, localTimestamp) çiftleri üzerinde linear regression
 * 3. Her hamle için fitted localTimestamp hesapla
 * 4. İlk hamleyi 0'a normalize et
 * 5. Düzeltilmiş completedAt ve toplam çözüm süresi döndür
 */
export function cubeTimestampLinearFit(
	moves: TimestampedMove[],
	solveStartTime: number
): LinearFitResult {
	if (moves.length === 0) {
		return { correctedMoves: [], finalTimeMs: 0 };
	}

	// Çalışma kopyası oluştur
	const work = moves.map((m) => ({
		...m,
		cubeTimestamp: m.cubeTimestamp ?? null,
		localTimestamp: m.localTimestamp ?? null,
	}));

	// --- Faz 1: Kaçan hamlelerin null timestamp'lerini interpolate et ---

	// cubeTimestamp: Geriye doğru geçiş (sonraki - 50ms)
	for (let i = work.length - 2; i >= 0; i--) {
		if (work[i].cubeTimestamp == null && work[i + 1].cubeTimestamp != null) {
			work[i].cubeTimestamp = work[i + 1].cubeTimestamp! - 50;
		}
	}
	// cubeTimestamp: İleriye doğru geçiş (önceki + 50ms)
	for (let i = 1; i < work.length; i++) {
		if (work[i].cubeTimestamp == null && work[i - 1].cubeTimestamp != null) {
			work[i].cubeTimestamp = work[i - 1].cubeTimestamp! + 50;
		}
	}

	// localTimestamp: Geriye doğru geçiş
	for (let i = work.length - 2; i >= 0; i--) {
		if (work[i].localTimestamp == null && work[i + 1].localTimestamp != null) {
			work[i].localTimestamp = work[i + 1].localTimestamp! - 50;
		}
	}
	// localTimestamp: İleriye doğru geçiş
	for (let i = 1; i < work.length; i++) {
		if (work[i].localTimestamp == null && work[i - 1].localTimestamp != null) {
			work[i].localTimestamp = work[i - 1].localTimestamp! + 50;
		}
	}

	// --- Faz 2: Geçerli (cubeTimestamp, localTimestamp) çiftlerini topla ---
	const validPairs: { cube: number; local: number }[] = [];
	for (const m of work) {
		if (m.cubeTimestamp != null && m.localTimestamp != null) {
			validPairs.push({ cube: m.cubeTimestamp, local: m.localTimestamp });
		}
	}

	if (validPairs.length < 2) {
		// Yeterli veri yok — ham completedAt değerlerini döndür (fallback)
		const first = moves[0].completedAt;
		const last = moves[moves.length - 1].completedAt;
		return {
			correctedMoves: moves.map((m) => ({ ...m })),
			finalTimeMs: last - first,
		};
	}

	// --- Faz 3: Normalizasyonlu linear regression ---
	// Büyük timestamp değerlerinde floating-point catastrophic cancellation'ı önle
	const baseCube = validPairs[0].cube;
	const baseLocal = validPairs[0].local;
	const xs = validPairs.map((p) => p.cube - baseCube);
	const ys = validPairs.map((p) => p.local - baseLocal);
	const [slope, intercept] = linregress(xs, ys);

	// --- Faz 4: Her hamle için fitted timestamp hesapla ---
	const correctedMoves: CorrectedMove[] = work.map((m) => {
		if (m.cubeTimestamp != null) {
			const fittedLocal = slope * (m.cubeTimestamp - baseCube) + intercept + baseLocal;
			return {
				...m,
				completedAt: Math.round(fittedLocal),
			};
		}
		// Hala null ise (tüm değerler null) — orijinal completedAt'i koru
		return { ...m };
	});

	// --- Faz 5: Çözüm süresini hesapla ---
	const firstFitted = correctedMoves[0].completedAt;
	const lastFitted = correctedMoves[correctedMoves.length - 1].completedAt;
	const finalTimeMs = lastFitted - firstFitted;

	return { correctedMoves, finalTimeMs };
}
