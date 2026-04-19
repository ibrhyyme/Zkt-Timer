import { TimerModuleType } from './enums';

// Mobilde kullanilabilecek modul tipleri.
// Son Cozum -> Cozumler'de zaten gorunuyor
// Tutarlilik, Istatistikler -> StatsBar ve Stats sayfasinda zaten var
// Hicbiri -> kullanici illa bir sey secmeli
export const MOBILE_MODULE_OPTIONS: TimerModuleType[] = [
	TimerModuleType.HISTORY,
	TimerModuleType.SCRAMBLE,
	TimerModuleType.CROSS_SOLVER,
	TimerModuleType.SOLVE_GRAPH,
	TimerModuleType.TIME_DISTRO,
];
