import { updateSolveDb } from './update';
import { Solve } from '../../../server/schemas/Solve.schema';

export function toggleDnfSolveDb(solve: Solve) {
	if (!solve) {
		return;
	}

	// Sistem DNF'i ise (inspection timeout - raw_time 0) kaldırmaya izin verme
	if (solve.dnf && solve.raw_time === 0) {
		return;
	}

	solve.dnf = !solve.dnf;
	updateSolveDb(solve, {
		dnf: solve.dnf,
	});
}

export function togglePlusTwoSolveDb(solve: Solve) {
	if (!solve) {
		return;
	}

	solve.plus_two = !solve.plus_two;
	updateSolveDb(solve, {
		plus_two: solve.plus_two,
	});
}

export function setOkSolveDb(solve: Solve) {
	if (!solve) {
		return;
	}

	// Sistem DNF'i ise (inspection timeout) OK'a izin verme
	if (solve.dnf && solve.raw_time === 0) {
		return;
	}

	solve.dnf = false;
	solve.plus_two = false;
	updateSolveDb(solve, {
		dnf: solve.dnf,
		plus_two: solve.plus_two
	});
}
