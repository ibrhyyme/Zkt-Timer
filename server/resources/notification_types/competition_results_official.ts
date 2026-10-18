import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';
import {WcaApiService} from '../../services/WcaApiService';
import {formatWcaResult, OfficialBest, RankLine} from '../../services/CompetitionLifecycle';
import CompetitionLifecycleNotification, {
	LifecycleMeta,
	lifecycleCompetitionPath,
	lifecyclePersonPath,
} from './competition_lifecycle_base';

interface ResultsOfficialMeta extends LifecycleMeta {
	// National rank moves for new PBs, when WCA's rank tables have caught up.
	rankLines?: RankLine[];
	// New PBs whose rank never caught up within the wait window.
	pbs?: OfficialBest[];
}

const MAX_LINES = 2;

/**
 * The competition's results are official: posted by WCA, or published by the
 * federation. WCA ones lead with the national rank climb when there is one; ZKT
 * has no rankings endpoint, so ZKT ones are always the plain body.
 */
export default class CompetitionResultsOfficialNotification extends CompetitionLifecycleNotification {
	private rankLines: RankLine[];
	private pbs: OfficialBest[];

	constructor(input: NotificationInput, meta: ResultsOfficialMeta) {
		super(input, meta);
		this.rankLines = meta.rankLines || [];
		this.pbs = meta.pbs || [];
	}

	notificationType() {
		return NotificationType.COMPETITION_RESULTS_OFFICIAL;
	}

	subject() {
		return this.t('notif_results_title', {competitionName: this.meta.competitionName});
	}

	private withMore(lines: string[]): string {
		const shown = lines.slice(0, MAX_LINES).join(' · ');
		const rest = lines.length - MAX_LINES;
		return rest > 0 ? `${shown} (${this.t('notif_results_more', {count: rest})})` : shown;
	}

	detail() {
		if (this.rankLines.length) {
			return this.withMore(
				this.rankLines.map((l) => {
					const vars = {
						eventName: WcaApiService.getShortEventName(l.eventId),
						type: this.typeLabel(l.type),
						before: l.before,
						after: l.after,
					};
					return l.before != null ? this.t('notif_results_rank', vars) : this.t('notif_results_first_rank', vars);
				})
			);
		}
		if (this.pbs.length) {
			return this.withMore(
				this.pbs.map((pb) =>
					this.t('notif_results_pb', {
						eventName: WcaApiService.getShortEventName(pb.eventId),
						type: this.typeLabel(pb.type),
						result: formatWcaResult(pb.best, pb.eventId, pb.type),
					})
				)
			);
		}
		return this.t('notif_results_body');
	}

	icon() {
		return 'trophy';
	}

	relativeLink() {
		const {source, competitionId, registrantId} = this.meta;
		if (source === 'zkt' || registrantId == null) {
			// A ZKT person's page on the competition carries their results.
			return source === 'zkt'
				? lifecyclePersonPath(competitionId, registrantId)
				: lifecycleCompetitionPath(competitionId);
		}
		return `/competitions/${competitionId}/persons/${registrantId}/results`;
	}
}
