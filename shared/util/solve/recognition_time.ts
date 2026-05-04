/**
 * Recognition time hesabi — her phase icin "dusunme suresi" vs "uygulama suresi" ayrimi.
 *
 * cstimer convention:
 *   - tsStart: phase'in baslangici (onceki phase'in bitis zamani)
 *   - tsFirst: bu phase'in ILK efektif hamlesi (rotation degil)
 *   - tsEnd: phase'in bitisi
 *
 *   recognitionTime = tsFirst - tsStart  (kullanici phase'i tanidi, uygulamaya basladi)
 *   executionTime   = tsEnd - tsFirst    (hamleleri uyguladi)
 *
 * Eger phase rotation-only ise (ornek: y rotation yapip durduktan sonra phase basladi),
 * tsFirst halen efektif move'a esit olur, recognition cogunlukla rotation suresinin
 * dahili olarak verilir (cstimer tarzi).
 */

export interface PhaseTiming {
	startMs: number;
	firstMoveMs: number;
	endMs: number;
}

export interface PhaseTimingResult {
	totalMs: number;
	recognitionMs: number;
	executionMs: number;
}

export function computePhaseTiming(t: PhaseTiming): PhaseTimingResult {
	const totalMs = Math.max(0, t.endMs - t.startMs);
	const firstMoveMs = isFinite(t.firstMoveMs) ? t.firstMoveMs : t.startMs;
	const recognitionMs = Math.max(0, firstMoveMs - t.startMs);
	const executionMs = Math.max(0, t.endMs - firstMoveMs);
	return { totalMs, recognitionMs, executionMs };
}
