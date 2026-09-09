import {Arg, Authorized, Ctx, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {RecordWatch, SaveRecordWatchInput} from '../schemas/RecordWatch.schema';
import {getPrisma} from '../database';
import {Consts} from '../../shared/consts';
import {WCA_EVENT_IDS, WCA_CONTINENTS, COUNTRY_TO_CONTINENT} from '../../shared/wca_geo';
import {sendPushToUser} from '../services/push';
import {fetchRecentRecords, formatRecordResult} from '../services/WcaLiveService';
import {WcaApiService} from '../services/WcaApiService';
import RecordBrokenNotification, {RecordSource} from '../resources/notification_types/record_broken';
import {ZktFederationService} from '../services/ZktFederationService';
import {ZKT_PREFIX, zktRecordsToRecordEntries} from '../services/ZktWcaAdapter';

const EVENT_SET = new Set(WCA_EVENT_IDS);
const CONTINENT_SET = new Set(WCA_CONTINENTS.map((c) => c.id));
const SCOPES = new Set(['WR', 'CR', 'NR']);

@Resolver()
export class RecordWatchResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => [RecordWatch])
	async myRecordWatches(@Ctx() context: GraphQLContext): Promise<RecordWatch[]> {
		return getPrisma().recordWatch.findMany({
			where: {user_id: context.user.id},
			orderBy: {created_at: 'asc'},
		}) as any;
	}

	@Authorized([Role.LOGGED_IN, Role.PRO])
	@Mutation(() => RecordWatch)
	async saveRecordWatch(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: SaveRecordWatchInput
	): Promise<RecordWatch> {
		const {user} = context;

		// Validate + normalize events (dedup, only official WCA events)
		const events = Array.from(new Set((input.events || []).map((e) => e.trim()))).filter((e) =>
			EVENT_SET.has(e)
		);
		if (events.length === 0) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'At least one valid event is required');
		}

		const scope = (input.scope || '').trim().toUpperCase();
		if (!SCOPES.has(scope)) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Invalid scope');
		}

		// Region: required + validated for CR/NR, ignored for WR
		let region = (input.region || '').trim();
		if (scope === 'WR') {
			region = '';
		} else if (scope === 'CR') {
			if (!CONTINENT_SET.has(region)) {
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'Invalid continent');
			}
		} else if (scope === 'NR') {
			region = region.toUpperCase();
			if (!COUNTRY_TO_CONTINENT[region]) {
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'Invalid country');
			}
		}

		const count = await getPrisma().recordWatch.count({where: {user_id: user.id}});
		if (count >= Consts.MAX_RECORD_WATCHES) {
			throw new GraphQLError(
				ErrorCode.FORBIDDEN,
				`Max ${Consts.MAX_RECORD_WATCHES} record watches`
			);
		}

		const created = await getPrisma().recordWatch.create({
			data: {
				user_id: user.id,
				events,
				scope,
				region,
				enabled: true,
			},
		});

		return created as any;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => RecordWatch)
	async setRecordWatchEnabled(
		@Ctx() context: GraphQLContext,
		@Arg('id') id: string,
		@Arg('enabled') enabled: boolean
	): Promise<RecordWatch> {
		const watch = await getPrisma().recordWatch.findUnique({where: {id}});
		if (!watch || watch.user_id !== context.user.id) {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'Not your watch');
		}
		const updated = await getPrisma().recordWatch.update({
			where: {id},
			data: {enabled},
		});
		return updated as any;
	}

	// Admin-only: fire a sample record-broken notification to yourself so you can
	// see exactly how it arrives (push + in-app). Uses a real recent record when
	// available so the deep-link works; otherwise falls back to a fixed sample.
	@Authorized([Role.ADMIN])
	@Mutation(() => Boolean)
	async sendTestRecordNotification(
		@Ctx() context: GraphQLContext,
		@Arg('locale', {nullable: true}) locale?: string,
		@Arg('source', {nullable: true}) source?: string
	): Promise<boolean> {
		const {user} = context;
		const loc = locale && ['tr', 'en', 'es', 'ru', 'zh'].includes(locale) ? locale : 'en';
		const src: RecordSource = String(source).toUpperCase() === 'ZKT' ? 'ZKT' : 'WCA';

		let meta: any = null;
		try {
			meta = src === 'ZKT' ? await zktSampleMeta(loc) : await wcaSampleMeta(loc);
		} catch {
			// fall through to the fixed sample
		}

		if (!meta) meta = fixedSampleMeta(src, loc);

		const notif = new RecordBrokenNotification({user, triggeringUser: user, sendEmail: false}, {...meta, source: src});
		await notif.send();
		await sendPushToUser(user.id, notif.subject(), notif.inAppMessage(), {
			type: notif.notificationType(),
			link: notif.relativeLink(),
			competitionId: meta.competitionId,
			eventId: meta.eventId,
			roundNumber: String(meta.roundNumber),
		}).catch(() => {});

		return true;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async deleteRecordWatch(
		@Ctx() context: GraphQLContext,
		@Arg('id') id: string
	): Promise<boolean> {
		const watch = await getPrisma().recordWatch.findUnique({where: {id}});
		if (!watch) {
			return true;
		}
		if (watch.user_id !== context.user.id) {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'Not your watch');
		}
		await getPrisma().recordWatch.delete({where: {id}});
		return true;
	}
}

// ---------------------------------------------------------------------------
// Sample payloads for the admin "send test notification" button. Real data is
// preferred so the wording can be checked against something an actual member
// would receive; the fixed sample only covers the case where the source is
// unreachable.
// ---------------------------------------------------------------------------

async function wcaSampleMeta(locale: string): Promise<any | null> {
	const recents = await fetchRecentRecords();
	const r = recents.find((x) => x.competitionId && x.eventId && x.roundNumber) || recents[0];
	if (!r) return null;
	return {
		competitionId: r.competitionId || '',
		competitionName: r.competitionName,
		eventId: r.eventId,
		eventName: WcaApiService.getShortEventName(r.eventId),
		recordTag: r.tag,
		resultText: formatRecordResult(r.attemptResult, r.eventId, r.type === 'average'),
		personName: r.personName,
		roundNumber: r.roundNumber || 1,
		locale,
	};
}

async function zktSampleMeta(locale: string): Promise<any | null> {
	const payload = await ZktFederationService.fetchRecentRecords(10);
	const items = (payload as any)?.items || [];
	const entries = zktRecordsToRecordEntries(items);
	if (entries.length === 0) return null;

	const idx = entries.findIndex((e: any) => e.roundNumber);
	const entry = entries[idx >= 0 ? idx : 0];
	// The recent-records feed carries the competition slug per row, and the entry
	// mapper drops it (it maps to the records shape, which has no slug column), so
	// read it back off the matching raw item.
	const raw = items[idx >= 0 ? idx : 0] || {};

	return {
		competitionId: `${ZKT_PREFIX}${raw.competitionSlug || raw.competitionId || ''}`,
		competitionName: raw.competitionName || '',
		eventId: entry.eventId,
		eventName: entry.eventName || WcaApiService.getShortEventName(entry.eventId),
		recordTag: entry.tag,
		resultText: formatRecordResult(entry.attemptResult, entry.eventId, entry.type === 'average'),
		personName: entry.personName,
		roundNumber: entry.roundNumber || 1,
		locale,
	};
}

function fixedSampleMeta(source: RecordSource, locale: string): any {
	if (source === 'ZKT') {
		return {
			competitionId: `${ZKT_PREFIX}ornek-yarisma`,
			competitionName: 'Örnek Yarışma',
			eventId: '333',
			eventName: '3x3',
			recordTag: 'NR',
			resultText: '6.42',
			personName: 'Örnek Yarışmacı',
			roundNumber: 1,
			locale,
		};
	}
	return {
		competitionId: '',
		competitionName: 'Test Competition',
		eventId: '333',
		eventName: '3x3',
		recordTag: 'WR',
		resultText: '3.13',
		personName: 'Max Park',
		roundNumber: 1,
		locale,
	};
}
