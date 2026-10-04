import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {createI18nInstance} from '../../i18n_server';
import {zktSlugOf} from '../../services/ZktWcaAdapter';
import {WcaApiService} from '../../services/WcaApiService';
import {parseActivityCode} from '../../services/WcifTransformer';
import {formatCompTime, LifecycleSource, ResultType, TimelineEntry} from '../../services/CompetitionLifecycle';

export const LIFECYCLE_LOCALES = ['tr', 'en', 'es', 'ru', 'zh'];

export function lifecycleLocale(locale?: string | null): string {
	return locale && LIFECYCLE_LOCALES.includes(locale) ? locale : 'en';
}

export interface LifecycleMeta {
	source: LifecycleSource;
	competitionId: string; // WCA id, or `zkt-<slug>`
	competitionName: string;
	registrantId?: number | null;
	timezone?: string | null;
	locale?: string;
}

/** The competition page. ZKT routes key on the bare slug, so the prefix comes off. */
export function lifecycleCompetitionPath(source: LifecycleSource, competitionId: string): string {
	return source === 'zkt' ? `/zkt-competitions/${zktSlugOf(competitionId)}` : `/competitions/${competitionId}`;
}

/**
 * The person's own page on that competition: their groups and duties. The ZKT
 * competitor route accepts the registration number, which is what the ZKT WCIF
 * publishes as registrantId.
 */
export function lifecyclePersonPath(source: LifecycleSource, competitionId: string, registrantId?: number | null): string {
	if (registrantId == null) return lifecycleCompetitionPath(source, competitionId);
	return source === 'zkt'
		? `/zkt-competitions/${zktSlugOf(competitionId)}/competitors/${registrantId}`
		: `/competitions/${competitionId}/persons/${registrantId}`;
}

/**
 * Shared shape of the per-registrant lifecycle notifications (groups, schedule,
 * official results). Push payloads carry `relativeLink()`: the client navigates
 * in-app for a relative link and opens an absolute one in the in-app browser.
 */
export default abstract class CompetitionLifecycleNotification extends Notification {
	protected meta: LifecycleMeta;
	protected locale: string;
	protected i18n: ReturnType<typeof createI18nInstance>;

	protected constructor(input: NotificationInput, meta: LifecycleMeta) {
		super(input);
		this.meta = meta;
		this.locale = lifecycleLocale(meta.locale);
		this.i18n = createI18nInstance(this.locale);
	}

	protected t(key: string, vars?: any): string {
		return this.i18n.t(`my_schedule.${key}`, vars) as string;
	}

	protected isZkt(): boolean {
		return this.meta.source === 'zkt';
	}

	protected time(iso: string | null, style: 'weekday_time' | 'time' = 'weekday_time'): string {
		return formatCompTime(iso, this.meta.timezone || null, this.locale, style);
	}

	protected typeLabel(type: ResultType): string {
		return this.t(type === 'single' ? 'notif_type_single' : 'notif_type_average');
	}

	/** "3x3 Round 1 Group 2", with the duty in front for anything but competing. */
	protected activityLabel(entry: TimelineEntry): string {
		const parsed = parseActivityCode(entry.activityCode);
		let label: string;
		if (parsed.roundNumber) {
			const eventName = WcaApiService.getShortEventName(parsed.eventId);
			label = parsed.groupNumber
				? this.t('notif_activity_group', {eventName, roundNumber: parsed.roundNumber, groupNumber: parsed.groupNumber})
				: this.t('notif_activity_round', {eventName, roundNumber: parsed.roundNumber});
		} else {
			label = entry.name || entry.activityCode;
		}
		const role = this.roleLabel(entry.assignmentCode);
		return role ? `${role} · ${label}` : label;
	}

	private roleLabel(assignmentCode: string): string | null {
		switch (assignmentCode) {
			case 'competitor':
			case 'registered':
				return null;
			case 'staff-judge':
				return this.t('role_judge');
			case 'staff-scrambler':
				return this.t('role_scrambler');
			case 'staff-runner':
				return this.t('role_runner');
			default:
				return this.t('role_staff');
		}
	}

	abstract relativeLink(): string;

	/**
	 * The detail line, without the competition. This is the push body: on a
	 * phone the title (subject) sits right above it and already names the
	 * competition and what happened.
	 */
	abstract detail(): string;

	/**
	 * The inbox row shows only the category ("WCA" / "ZKT") and this text, never
	 * the subject, so it has to stand on its own: competition and event first,
	 * then the detail.
	 */
	inAppMessage() {
		return `${this.subject()} · ${this.detail()}`;
	}

	link() {
		return `${process.env.BASE_URI}${this.relativeLink()}`;
	}

	message() {
		return this.inAppMessage();
	}

	linkText() {
		return this.t('notif_countdown_link_text');
	}

	categoryName() {
		return this.isZkt() ? 'ZKT' : 'WCA';
	}

	/** FCM data: every value must be a string. */
	pushData(): Record<string, string> {
		return {
			type: this.notificationType(),
			competitionId: this.meta.competitionId,
			link: this.relativeLink(),
		};
	}

	customData(): object {
		return {
			source: this.meta.source,
			competitionId: this.meta.competitionId,
			registrantId: this.meta.registrantId ?? null,
		};
	}
}
