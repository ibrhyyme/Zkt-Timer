import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';
import {diffSize, TimelineDiff} from '../../services/CompetitionLifecycle';
import CompetitionLifecycleNotification, {LifecycleMeta, lifecyclePersonPath} from './competition_lifecycle_base';

interface ScheduleChangedMeta extends LifecycleMeta {
	diff: TimelineDiff;
}

/**
 * Times (or, after groups are out, the groups themselves) changed in the user's
 * own schedule. A burst of edits arrives as one diff; the body leads with the
 * first change and counts the rest.
 */
export default class CompetitionScheduleChangedNotification extends CompetitionLifecycleNotification {
	private diff: TimelineDiff;

	constructor(input: NotificationInput, meta: ScheduleChangedMeta) {
		super(input, meta);
		this.diff = meta.diff;
	}

	notificationType() {
		return NotificationType.COMPETITION_SCHEDULE_CHANGED;
	}

	subject() {
		return this.t('notif_schedule_title', {competitionName: this.meta.competitionName});
	}

	private leadLine(): string {
		const {changed, added, removed} = this.diff;
		if (changed.length) {
			const c = changed[0];
			return this.t('notif_schedule_time', {
				activity: this.activityLabel(c.after),
				before: this.time(c.before.start),
				after: this.time(c.after.start),
			});
		}
		if (added.length) {
			return this.t('notif_schedule_added', {activity: this.activityLabel(added[0]), time: this.time(added[0].start)});
		}
		if (removed.length) {
			return this.t('notif_schedule_removed', {activity: this.activityLabel(removed[0])});
		}
		return '';
	}

	detail() {
		const lead = this.leadLine();
		const rest = diffSize(this.diff) - 1;
		return rest > 0 ? `${lead} (${this.t('notif_schedule_more', {count: rest})})` : lead;
	}

	icon() {
		return 'calendar';
	}

	relativeLink() {
		return lifecyclePersonPath(this.meta.source, this.meta.competitionId, this.meta.registrantId);
	}
}
