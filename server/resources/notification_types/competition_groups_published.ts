import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';
import {AssignmentSummary} from '../../services/CompetitionLifecycle';
import CompetitionLifecycleNotification, {LifecycleMeta, lifecyclePersonPath} from './competition_lifecycle_base';

interface GroupsPublishedMeta extends LifecycleMeta {
	summary: AssignmentSummary;
}

/** Group assignments for a competition the user is registered for are out. */
export default class CompetitionGroupsPublishedNotification extends CompetitionLifecycleNotification {
	private summary: AssignmentSummary;

	constructor(input: NotificationInput, meta: GroupsPublishedMeta) {
		super(input, meta);
		this.summary = meta.summary;
	}

	notificationType() {
		return NotificationType.COMPETITION_GROUPS_PUBLISHED;
	}

	subject() {
		return this.t('notif_groups_title', {competitionName: this.meta.competitionName});
	}

	detail() {
		const parts: string[] = [];
		const first = this.summary.competing[0];
		if (first) {
			parts.push(this.t('notif_groups_first', {activity: this.activityLabel(first), time: this.time(first.start)}));
		}
		const {judge, scrambler, runner, other} = this.summary.duties;
		if (judge) parts.push(this.t('notif_groups_duty_judge', {count: judge}));
		if (scrambler) parts.push(this.t('notif_groups_duty_scrambler', {count: scrambler}));
		if (runner) parts.push(this.t('notif_groups_duty_runner', {count: runner}));
		if (other) parts.push(this.t('notif_groups_duty_other', {count: other}));
		return parts.length ? parts.join(' · ') : this.t('notif_groups_body_generic');
	}

	icon() {
		return 'calendar';
	}

	relativeLink() {
		return lifecyclePersonPath(this.meta.competitionId, this.meta.registrantId);
	}
}
