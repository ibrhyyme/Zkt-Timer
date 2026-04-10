import {WcaApiService} from './WcaApiService';

// --- WCIF Interfaces ---

interface WcifActivity {
	id: number;
	name: string;
	activityCode: string;
	startTime: string;
	endTime: string;
	childActivities: WcifActivity[];
	scrambleSetId?: number;
}

interface WcifRoom {
	id: number;
	name: string;
	color: string;
	activities: WcifActivity[];
}

interface WcifVenue {
	id: number;
	name: string;
	latitudeMicrodegrees: number;
	longitudeMicrodegrees: number;
	timezone: string;
	rooms: WcifRoom[];
}

interface WcifAssignment {
	activityId: number;
	assignmentCode: string;
	stationNumber?: number;
}

interface WcifPersonalBest {
	eventId: string;
	best: number;
	type: 'single' | 'average';
	worldRanking: number;
	continentalRanking: number;
	nationalRanking: number;
}

interface WcifPerson {
	registrantId: number;
	wcaUserId: number;
	wcaId: string;
	name: string;
	countryIso2?: string;
	roles: string[];
	registration?: {
		eventIds: string[];
		status: string;
	};
	assignments: WcifAssignment[];
	personalBests?: WcifPersonalBest[];
}

interface WcifData {
	id: string;
	name: string;
	persons: WcifPerson[];
	events?: {
		id: string;
		rounds: {
			id: string;
			format: string;
			timeLimit?: {centiseconds: number; cumulativeRoundIds?: string[]};
			cutoff?: {numberOfAttempts: number; attemptResult: number};
			advancementCondition?: {type: string; level: number};
			results?: {
				personId: number;
				ranking: number | null;
				best: number;
				average: number;
				attempts: {result: number}[];
			}[];
		}[];
	}[];
	schedule: {
		startDate: string;
		numberOfDays: number;
		venues: WcifVenue[];
	};
}

interface ActivityInfo {
	id: number;
	name: string;
	activityCode: string;
	startTime: string;
	endTime: string;
	roomName: string;
	roomColor: string;
	venueName: string;
}

// --- Schedule types (Tab 3) ---

export interface ScheduleAssignment {
	activityCode: string;
	eventName: string;
	roundNumber: number;
	groupNumber: number | null;
	assignmentCode: string;
	startTime: string;
	endTime: string;
	roomName: string;
	roomColor: string | null;
	venueName: string;
	stationNumber: number | null;
}

export interface ScheduleDay {
	date: string;
	assignments: ScheduleAssignment[];
}

// --- Competitor types (Tab 1) ---

export interface CompetitorAssignment {
	activityCode: string;
	eventName: string;
	roundNumber: number;
	groupNumber: number | null;
	assignmentCode: string;
	startTime: string | null;
	endTime: string | null;
	stationNumber: number | null;
	roomName: string | null;
}


export interface PersonalBestEntry {
	eventId: string;
	type: string;
	best: number;
	worldRanking: number;
	continentalRanking: number;
	nationalRanking: number;
}

export interface CompetitorEntry {
	name: string;
	wcaId: string | null;
	country: string | null;
	avatar: string | null;
	registrantId: number;
	wcaUserId: number | null;
	registeredEvents: string[];
	assignments: CompetitorAssignment[];
	personalBests: PersonalBestEntry[];
}

// --- Event types (Tab 2) ---

export interface GroupCompetitor {
	name: string;
	wcaId: string | null;
	registrantId: number;
	assignmentCode: string;
	seedResult: number | null;
}

export interface GroupEntry {
	groupNumber: number;
	activityCode: string;
	competitors: GroupCompetitor[];
	startTime: string | null;
	endTime: string | null;
}

export interface RoundEntry {
	roundNumber: number;
	format: string;
	timeLimit: number | null;
	cutoff: number | null;
	cutoffAttempts: number | null;
	advancementType: string | null;
	advancementLevel: number | null;
	groups: GroupEntry[];
}

export interface EventDetailEntry {
	eventId: string;
	eventName: string;
	rounds: RoundEntry[];
}

// --- Rankings types (Tab 4) ---

export interface RankingRow {
	name: string;
	wcaId: string | null;
	registrantId: number;
	eventId: string;
	single: number | null;
	average: number | null;
	singleWorldRank: number | null;
	averageWorldRank: number | null;
}

// --- Competition Detail (root) ---

export interface CompetitionDetail {
	competitionId: string;
	competitionName: string;
	myWcaId: string | null;
	myRegistrationStatus: string | null;
	myRegisteredEvents: string[];
	competitors: CompetitorEntry[];
	events: EventDetailEntry[];
	schedule: ScheduleDay[];
	allPersonalBests: RankingRow[];
	wcaLiveCompId: string | null;
	wcaLiveCompetitors: {wcaId: string | null; liveId: string; name: string}[];
	wcaLiveRoundMap: {activityCode: string; liveRoundId: string}[];
	info: any;
}

// --- Helpers ---

const ACTIVITY_CODE_REGEX = /^(\w+)-r(\d+)(?:-g(\d+))?(?:-a(\d+))?$/;

function flattenActivities(venues: WcifVenue[]): Map<number, ActivityInfo> {
	const map = new Map<number, ActivityInfo>();

	for (const venue of venues) {
		for (const room of venue.rooms) {
			const addActivity = (activity: WcifActivity) => {
				map.set(activity.id, {
					id: activity.id,
					name: activity.name,
					activityCode: activity.activityCode,
					startTime: activity.startTime,
					endTime: activity.endTime,
					roomName: room.name,
					roomColor: room.color,
					venueName: venue.name,
				});

				for (const child of activity.childActivities || []) {
					addActivity(child);
				}
			};

			for (const activity of room.activities) {
				addActivity(activity);
			}
		}
	}

	return map;
}

function parseActivityCode(activityCode: string): {eventId: string; roundNumber: number; groupNumber: number | null} {
	const match = activityCode.match(ACTIVITY_CODE_REGEX);
	if (!match) {
		return {eventId: activityCode, roundNumber: 0, groupNumber: null};
	}

	return {
		eventId: match[1],
		roundNumber: parseInt(match[2], 10),
		groupNumber: match[3] ? parseInt(match[3], 10) : null,
	};
}

function extractDate(isoString: string): string {
	return isoString.substring(0, 10);
}

function groupByDay(assignments: ScheduleAssignment[]): ScheduleDay[] {
	const dayMap = new Map<string, ScheduleAssignment[]>();
	for (const a of assignments) {
		const date = extractDate(a.startTime);
		if (!dayMap.has(date)) {
			dayMap.set(date, []);
		}
		dayMap.get(date).push(a);
	}

	return Array.from(dayMap.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, dayAssignments]) => ({
			date,
			assignments: dayAssignments.sort((a, b) => a.startTime.localeCompare(b.startTime)),
		}));
}

// --- Tab 3: Schedule ---

function buildSchedule(wcifData: WcifData): ScheduleDay[] {
	const assignments: ScheduleAssignment[] = [];

	for (const venue of wcifData.schedule?.venues || []) {
		for (const room of venue.rooms) {
			for (const activity of room.activities) {
				const parsed = parseActivityCode(activity.activityCode);

				assignments.push({
					activityCode: activity.activityCode,
					eventName: activity.name || WcaApiService.getEventName(parsed.eventId),
					roundNumber: parsed.roundNumber,
					groupNumber: null,
					assignmentCode: 'schedule',
					startTime: activity.startTime,
					endTime: activity.endTime,
					roomName: room.name,
					roomColor: room.color || null,
					venueName: venue.name,
					stationNumber: null,
				});
			}
		}
	}

	return groupByDay(assignments);
}

// --- Tab 1: Competitors ---

function buildCompetitorsList(persons: WcifPerson[], activityMap: Map<number, ActivityInfo>): CompetitorEntry[] {
	const accepted = persons.filter((p) => p.registration?.status === 'accepted');

	return accepted
		.map((person) => {
			const assignments: CompetitorAssignment[] = [];

			for (const assignment of person.assignments || []) {
				const activity = activityMap.get(assignment.activityId);
				const parsed = activity ? parseActivityCode(activity.activityCode) : null;

				assignments.push({
					activityCode: activity?.activityCode || '',
					eventName: parsed ? WcaApiService.getEventName(parsed.eventId) : '',
					roundNumber: parsed?.roundNumber || 0,
					groupNumber: parsed?.groupNumber || null,
					assignmentCode: assignment.assignmentCode,
					startTime: activity?.startTime || null,
					endTime: activity?.endTime || null,
					stationNumber: assignment.stationNumber || null,
					roomName: activity?.roomName || null,
				});
			}

			// startTime'a gore sirala
			assignments.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

			return {
				name: person.name,
				wcaId: person.wcaId || null,
				country: person.countryIso2 || null,
				avatar: (person as any).avatar?.thumb_url || (person as any).avatar?.url || null,
				registrantId: person.registrantId,
				wcaUserId: person.wcaUserId || null,
				registeredEvents: person.registration?.eventIds || [],
				assignments,
				personalBests: (person.personalBests || []).map((pb) => ({
					eventId: pb.eventId,
					type: pb.type,
					best: pb.best,
					worldRanking: pb.worldRanking,
					continentalRanking: pb.continentalRanking,
					nationalRanking: pb.nationalRanking,
				})),
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}

// --- Tab 2: Events ---

function buildEventDetails(wcifData: WcifData, activityMap: Map<number, ActivityInfo>): EventDetailEntry[] {
	const persons = (wcifData.persons || []).filter((p) => p.registration?.status === 'accepted');

	// Ters mapping: activityId → atanmis kisiler
	const activityPersonMap = new Map<number, {name: string; wcaId: string | null; registrantId: number; assignmentCode: string}[]>();
	for (const person of persons) {
		for (const assignment of person.assignments || []) {
			if (!activityPersonMap.has(assignment.activityId)) {
				activityPersonMap.set(assignment.activityId, []);
			}
			activityPersonMap.get(assignment.activityId).push({
				name: person.name,
				wcaId: person.wcaId || null,
				registrantId: person.registrantId,
				assignmentCode: assignment.assignmentCode,
			});
		}
	}

	// Schedule'dan group aktivitelerini bul
	const groupActivities = new Map<string, {activity: ActivityInfo; children: ActivityInfo[]}>();

	for (const venue of wcifData.schedule?.venues || []) {
		for (const room of venue.rooms) {
			for (const activity of room.activities) {
				const parsed = parseActivityCode(activity.activityCode);
				if (parsed.roundNumber > 0) {
					const key = `${parsed.eventId}-r${parsed.roundNumber}`;
					const children = (activity.childActivities || []).map((child) => {
						const info = activityMap.get(child.id);
						return info;
					}).filter(Boolean);

					groupActivities.set(key, {
						activity: activityMap.get(activity.id),
						children,
					});
				}
			}
		}
	}

	const events = wcifData.events || [];

	// Onceki round sonuclarini seed olarak kullanmak icin result map
	const personBestMap = new Map<string, Map<number, number>>(); // eventId → registrantId → best
	for (const event of events) {
		for (const round of event.rounds) {
			if (!round.results?.length) continue;
			const key = event.id;
			if (!personBestMap.has(key)) personBestMap.set(key, new Map());
			const map = personBestMap.get(key);
			for (const r of round.results) {
				if (r.best > 0 && (!map.has(r.personId) || r.best < map.get(r.personId))) {
					map.set(r.personId, r.best);
				}
			}
		}
	}

	return events.map((event) => {
		const rounds: RoundEntry[] = event.rounds.map((round, idx) => {
			const roundNumber = idx + 1;
			const key = `${event.id}-r${roundNumber}`;
			const roundData = groupActivities.get(key);

			const groups: GroupEntry[] = [];

			if (roundData && roundData.children.length > 0) {
				for (const child of roundData.children) {
					const parsed = parseActivityCode(child.activityCode);
					if (parsed.groupNumber === null) continue;

					const assignedPersons = activityPersonMap.get(child.id) || [];
					const seedMap = personBestMap.get(event.id);

					const competitors: GroupCompetitor[] = assignedPersons
						.map((p) => ({
							...p,
							seedResult: seedMap?.get(p.registrantId) || null,
						}))
						.sort((a, b) => a.name.localeCompare(b.name));

					groups.push({
						groupNumber: parsed.groupNumber,
						activityCode: child.activityCode,
						competitors,
						startTime: child.startTime || null,
						endTime: child.endTime || null,
					});
				}

				groups.sort((a, b) => a.groupNumber - b.groupNumber);
			}

			return {
				roundNumber,
				format: round.format || '',
				timeLimit: round.timeLimit?.centiseconds || null,
				cutoff: round.cutoff?.attemptResult || null,
				cutoffAttempts: round.cutoff?.numberOfAttempts || null,
				advancementType: round.advancementCondition?.type || null,
				advancementLevel: round.advancementCondition?.level || null,
				groups,
			};
		});

		return {
			eventId: event.id,
			eventName: WcaApiService.getEventName(event.id),
			rounds,
		};
	});
}

// --- Tab 4: Rankings ---

function buildRankings(persons: WcifPerson[], competitionEventIds: Set<string>): RankingRow[] {
	const accepted = persons.filter((p) => p.registration?.status === 'accepted');
	const rows: RankingRow[] = [];

	for (const person of accepted) {
		if (!person.personalBests?.length) continue;

		// eventId bazli gruplama: single ve average ayri satirlarda geliyor
		const eventMap = new Map<string, {single?: WcifPersonalBest; average?: WcifPersonalBest}>();

		for (const pb of person.personalBests) {
			if (!competitionEventIds.has(pb.eventId)) continue;
			if (!eventMap.has(pb.eventId)) {
				eventMap.set(pb.eventId, {});
			}
			const entry = eventMap.get(pb.eventId);
			if (pb.type === 'single') entry.single = pb;
			if (pb.type === 'average') entry.average = pb;
		}

		for (const [eventId, data] of eventMap.entries()) {
			rows.push({
				name: person.name,
				wcaId: person.wcaId || null,
				registrantId: person.registrantId,
				eventId,
				single: data.single?.best || null,
				average: data.average?.best || null,
				singleWorldRank: data.single?.worldRanking || null,
				averageWorldRank: data.average?.worldRanking || null,
			});
		}
	}

	return rows;
}

// --- Info ---

function buildInfo(wcifData: WcifData): any {
	const venues = (wcifData.schedule?.venues || []).map((v) => ({
		name: v.name,
		address: (wcifData as any).venue_address || null,
		city: (wcifData as any).city || null,
	}));

	const persons = wcifData.persons || [];
	const organizers = persons
		.filter((p) => p.roles?.includes('organizer'))
		.map((p) => ({name: p.name, wcaId: p.wcaId || null, role: 'organizer', avatar: (p as any).avatar?.thumb_url || (p as any).avatar?.url || null}));

	const delegates = persons
		.filter((p) => p.roles?.includes('delegate') || p.roles?.includes('trainee-delegate'))
		.map((p) => ({name: p.name, wcaId: p.wcaId || null, role: 'delegate', avatar: (p as any).avatar?.thumb_url || (p as any).avatar?.url || null}));

	return {
		venues,
		organizers,
		delegates,
		wcaUrl: `https://www.worldcubeassociation.org/competitions/${wcifData.id}`,
	};
}

// --- Master builder ---

export function buildCompetitionDetail(wcifData: WcifData, myWcaId: string): CompetitionDetail | null {
	if (!wcifData) {
		return null;
	}

	const persons = wcifData.persons || [];
	const activityMap = flattenActivities(wcifData.schedule?.venues || []);

	const myPerson = myWcaId ? persons.find((p) => p.wcaId === myWcaId) : null;

	return {
		competitionId: wcifData.id,
		competitionName: wcifData.name,
		myWcaId: myPerson?.wcaId || myWcaId || null,
		myRegistrationStatus: myPerson?.registration?.status || null,
		myRegisteredEvents: myPerson?.registration?.eventIds || [],
		competitors: buildCompetitorsList(persons, activityMap),
		events: buildEventDetails(wcifData, activityMap),
		schedule: buildSchedule(wcifData),
		allPersonalBests: buildRankings(persons, new Set((wcifData.events || []).map((e) => e.id))),
		wcaLiveCompId: null,
		wcaLiveCompetitors: [],
		wcaLiveRoundMap: [],
		info: buildInfo(wcifData),
	};
}
