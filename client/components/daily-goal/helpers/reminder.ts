import {getDailyGoalStorage, setDailyGoalStorage} from './storage';
import {getDailyGoalProgress} from './progress';
import {getCubeTypeInfoById} from '../../../util/cubes/util';
import {isAppVisible} from '../../../util/app-visibility';
import {scheduleLocalNotification} from '../../../util/native-plugins';

const REMINDER_CHECK_INTERVAL = 60_000; // 60 saniye
const REMINDER_COOLDOWN = 60 * 60 * 1000; // 1 saat

export function startReminderInterval(): () => void {
	const intervalId = setInterval(() => {
		if (!isAppVisible()) return;
		checkAndSendReminder();
	}, REMINDER_CHECK_INTERVAL);

	return () => clearInterval(intervalId);
}

function checkAndSendReminder() {
	const storage = getDailyGoalStorage();
	if (!storage.reminder_enabled) return;

	// Son bildirimden yeterli sure gecti mi
	const now = Date.now();
	if (storage.last_reminder_time && now - storage.last_reminder_time < REMINDER_COOLDOWN) return;

	// Tamamlanmamis hedefleri bul
	const incompleteGoals = storage.goals
		.filter((g) => g.enabled)
		.filter((g) => {
			const progress = getDailyGoalProgress(g.cube_type);
			return progress && !progress.completed;
		});

	if (incompleteGoals.length === 0) return;

	// Ilk tamamlanmamis hedef icin bildirim gonder
	const goal = incompleteGoals[0];
	const progress = getDailyGoalProgress(goal.cube_type);
	const cubeInfo = getCubeTypeInfoById(goal.cube_type);

	const body = `${cubeInfo?.name || goal.cube_type}: ${progress.current}/${progress.target}`;
	scheduleLocalNotification({ title: 'Zkt-Timer', body });

	// Son bildirim zamanini guncelle
	storage.last_reminder_time = now;
	setDailyGoalStorage(storage);
}
