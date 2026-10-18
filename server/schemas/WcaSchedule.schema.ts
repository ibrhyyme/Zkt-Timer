import {ObjectType, Field, InputType, Int} from 'type-graphql';

// Tab 3 - Schedule (current)
@ObjectType()
export class WcaScheduleAssignment {
	@Field()
	activityCode: string;

	@Field()
	eventName: string;

	@Field(() => Int)
	roundNumber: number;

	@Field(() => Int, {nullable: true})
	groupNumber?: number;

	@Field()
	assignmentCode: string;

	@Field()
	startTime: string;

	@Field()
	endTime: string;

	@Field()
	roomName: string;

	@Field({nullable: true})
	roomColor?: string;

	@Field()
	venueName: string;

	@Field(() => Int, {nullable: true})
	stationNumber?: number;

	/** ZKT Dual Chance round: which of the two chances this group belongs to. */
	@Field(() => Int, {nullable: true})
	chance?: number;
}

@ObjectType()
export class WcaScheduleDay {
	@Field()
	date: string;

	@Field(() => [WcaScheduleAssignment])
	assignments: WcaScheduleAssignment[];
}

// Tab 1 - Groups
@ObjectType()
export class WcaCompetitorAssignment {
	@Field()
	activityCode: string;

	@Field()
	eventName: string;

	@Field(() => Int)
	roundNumber: number;

	@Field(() => Int, {nullable: true})
	groupNumber?: number;

	@Field()
	assignmentCode: string;

	@Field({nullable: true})
	startTime?: string;

	@Field({nullable: true})
	endTime?: string;

	@Field(() => Int, {nullable: true})
	stationNumber?: number;

	@Field({nullable: true})
	roomName?: string;

	/** ZKT Dual Chance round: which of the two chances this group belongs to. */
	@Field(() => Int, {nullable: true})
	chance?: number;
}

@ObjectType()
export class WcaPersonalBest {
	@Field()
	eventId: string;

	@Field()
	type: string;

	@Field(() => Int)
	best: number;

	@Field(() => Int)
	worldRanking: number;

	@Field(() => Int)
	continentalRanking: number;

	@Field(() => Int)
	nationalRanking: number;
}

/** One day of a day-split ZKT competition (federation concept, not WCA). */
@ObjectType()
export class WcaCompetitionDay {
	@Field(() => Int)
	position: number;

	@Field()
	label: string;

	/** YYYY-MM-DD. */
	@Field()
	date: string;

	/**
	 * True only when the organizer gave the day its own name. Otherwise `label`
	 * IS the date, and printing "label: date" would say it twice.
	 */
	@Field({nullable: true})
	named?: boolean;
}

@ObjectType()
export class WcaCompetitor {
	@Field()
	name: string;

	@Field({nullable: true})
	wcaId?: string;

	/**
	 * Federation competitor id, present only on ZKT competitions (and only for
	 * members who have already competed). It takes the place `wcaId` holds on a
	 * WCA competition: the id printed under the person's name.
	 */
	@Field({nullable: true})
	zktId?: string;

	@Field({nullable: true})
	country?: string;

	@Field({nullable: true})
	avatar?: string;

	@Field(() => Int)
	registrantId: number;

	@Field(() => Int, {nullable: true})
	wcaUserId?: number;

	@Field(() => [String])
	registeredEvents: string[];

	/**
	 * Day-split ZKT competitions ("A günü / B günü"): the day this competitor
	 * attends. Null on every WCA competition — WCIF has no such concept, so it
	 * arrives as a person extension and is simply absent elsewhere.
	 */
	@Field({nullable: true})
	dayLabel?: string;

	@Field(() => [WcaCompetitorAssignment])
	assignments: WcaCompetitorAssignment[];

	@Field(() => [WcaPersonalBest])
	personalBests: WcaPersonalBest[];
}

// Tab 2 - Events
@ObjectType()
export class WcaGroupCompetitor {
	@Field()
	name: string;

	@Field({nullable: true})
	wcaId?: string;

	@Field(() => Int)
	registrantId: number;

	@Field()
	assignmentCode: string;

	@Field(() => Int, {nullable: true})
	seedResult?: number;
}

@ObjectType()
export class WcaGroup {
	@Field(() => Int)
	groupNumber: number;

	@Field({nullable: true})
	activityCode?: string;

	@Field(() => [WcaGroupCompetitor])
	competitors: WcaGroupCompetitor[];

	@Field({nullable: true})
	startTime?: string;

	@Field({nullable: true})
	endTime?: string;

	/**
	 * ZKT Dual Chance round: 1 for groups 1..N, 2 for groups N+1..2N. The
	 * federation guarantees that numbering, so it is derived, not shipped.
	 */
	@Field(() => Int, {nullable: true})
	chance?: number;
}

@ObjectType()
export class WcaRound {
	@Field(() => Int)
	roundNumber: number;

	@Field({nullable: true})
	format?: string;

	@Field(() => Int, {nullable: true})
	timeLimit?: number;

	@Field(() => Int, {nullable: true})
	cutoff?: number;

	@Field(() => Int, {nullable: true})
	cutoffAttempts?: number;

	@Field({nullable: true})
	advancementType?: string;

	@Field(() => Int, {nullable: true})
	advancementLevel?: number;

	/**
	 * ZKT Dual Chance: every competitor does the format twice and the better
	 * chance counts. Not a WCA dual round; the round number and format stay the same.
	 */
	@Field({nullable: true})
	dualChance?: boolean;

	@Field(() => [WcaGroup])
	groups: WcaGroup[];
}

@ObjectType()
export class WcaEventDetail {
	@Field()
	eventId: string;

	@Field()
	eventName: string;

	/** Day-split ZKT competitions: the single day this event runs on, if pinned. */
	@Field({nullable: true})
	dayLabel?: string;

	@Field(() => [WcaRound])
	rounds: WcaRound[];
}

// Tab 4 - Rankings
@ObjectType()
export class WcaRankingRow {
	@Field()
	name: string;

	@Field({nullable: true})
	wcaId?: string;

	@Field(() => Int)
	registrantId: number;

	@Field()
	eventId: string;

	@Field(() => Int, {nullable: true})
	single?: number;

	@Field(() => Int, {nullable: true})
	average?: number;

	@Field(() => Int, {nullable: true})
	singleWorldRank?: number;

	@Field(() => Int, {nullable: true})
	averageWorldRank?: number;
}

// Info
@ObjectType()
export class WcaVenueInfo {
	@Field()
	name: string;

	@Field({nullable: true})
	address?: string;

	@Field({nullable: true})
	city?: string;
}

@ObjectType()
export class WcaPersonInfo {
	@Field()
	name: string;

	@Field({nullable: true})
	wcaId?: string;

	@Field()
	role: string;

	@Field({nullable: true})
	avatar?: string;
}

@ObjectType()
export class WcaCompetitionInfo {
	@Field(() => [WcaVenueInfo])
	venues: WcaVenueInfo[];

	@Field(() => [WcaPersonInfo])
	organizers: WcaPersonInfo[];

	@Field(() => [WcaPersonInfo])
	delegates: WcaPersonInfo[];

	@Field({nullable: true})
	wcaUrl?: string;
}

// Root type
@ObjectType()
export class WcaLiveCompetitor {
	@Field({nullable: true})
	wcaId?: string;

	@Field()
	liveId: string;

	@Field()
	name: string;
}

@ObjectType()
export class WcaLiveRoundMapping {
	@Field()
	activityCode: string;

	@Field()
	liveRoundId: string;
}

@ObjectType()
export class WcaLiveAttempt {
	@Field(() => Int)
	result: number;
}

/** One chance of a ZKT Dual Chance round result. */
@ObjectType()
export class WcaLiveChance {
	@Field(() => Int)
	chance: number;

	@Field(() => [WcaLiveAttempt])
	attempts: WcaLiveAttempt[];

	@Field(() => Int)
	best: number;

	@Field(() => Int)
	average: number;

	/** The competitor did not show up for this chance; read as DNS, not DNF. */
	@Field()
	noShow: boolean;

	/** The better chance, the one the row's own attempts and average come from. */
	@Field()
	counting: boolean;
}

@ObjectType()
export class WcaLiveResult {
	@Field(() => Int, {nullable: true})
	ranking?: number;

	@Field(() => Int)
	best: number;

	@Field(() => Int)
	average: number;

	@Field(() => [WcaLiveAttempt])
	attempts: WcaLiveAttempt[];

	@Field()
	personName: string;

	@Field({nullable: true})
	personWcaId?: string;

	@Field({nullable: true})
	personCountryIso2?: string;

	@Field()
	personLiveId: string;

	@Field({nullable: true})
	singleRecordTag?: string;

	@Field({nullable: true})
	averageRecordTag?: string;

	@Field()
	advancing: boolean;

	@Field()
	advancingQuestionable: boolean;

	/**
	 * ZKT Dual Chance round only. A chance the competitor never entered is absent
	 * from the list. The row's own attempts and average are the counting chance's,
	 * and `best` is the best single across both chances.
	 */
	@Field(() => [WcaLiveChance], {nullable: true})
	chances?: WcaLiveChance[];
}

@ObjectType()
export class WcaLiveTimeLimit {
	@Field(() => Int)
	centiseconds: number;

	@Field(() => [String])
	cumulativeRoundWcifIds: string[];
}

@ObjectType()
export class WcaLiveCutoff {
	@Field(() => Int)
	attemptResult: number;

	@Field(() => Int)
	numberOfAttempts: number;
}

@ObjectType()
export class WcaLiveAdvancementCondition {
	@Field()
	type: string; // "ranking" | "percent" | "attemptResult"

	@Field(() => Int)
	level: number;
}

@ObjectType()
export class WcaLiveFormat {
	@Field(() => Int)
	numberOfAttempts: number;

	@Field()
	sortBy: string;
}

@ObjectType()
export class WcaLiveRoundInfo {
	@Field()
	liveRoundId: string;

	@Field(() => Int)
	number: number;

	@Field()
	name: string;

	@Field()
	open: boolean;

	@Field()
	finished: boolean;

	@Field()
	active: boolean;

	@Field(() => Int)
	numEntered: number;

	@Field(() => Int)
	numResults: number;

	@Field(() => WcaLiveFormat, {nullable: true})
	format?: WcaLiveFormat;

	@Field(() => WcaLiveTimeLimit, {nullable: true})
	timeLimit?: WcaLiveTimeLimit;

	@Field(() => WcaLiveCutoff, {nullable: true})
	cutoff?: WcaLiveCutoff;

	@Field(() => WcaLiveAdvancementCondition, {nullable: true})
	advancementCondition?: WcaLiveAdvancementCondition;

	/**
	 * Day-chain this round belongs to on a day-split ZKT competition: such an
	 * event runs a whole chain per day, so it has two "1. Tur"s and the number
	 * alone does not identify a round. 0/null on every WCA competition and on the
	 * shared rounds that belong to no single day.
	 */
	@Field(() => Int, {nullable: true})
	dayIndex?: number;

	@Field({nullable: true})
	dayLabel?: string;

	/** Last round of its own chain — what the viewer reads as "Final". */
	@Field({nullable: true})
	isFinal?: boolean;

	/** ZKT Dual Chance round (see WcaRound.dualChance). */
	@Field({nullable: true})
	dualChance?: boolean;
}

@ObjectType()
export class WcaLiveEventInfo {
	@Field()
	eventId: string;

	@Field()
	eventName: string;

	@Field(() => [WcaLiveRoundInfo])
	rounds: WcaLiveRoundInfo[];
}

@ObjectType()
export class WcaLiveScheduleActivity {
	@Field(() => Int)
	activityId: number;

	@Field()
	name: string;

	@Field()
	activityCode: string;

	@Field()
	startTime: string;

	@Field()
	endTime: string;

	/**
	 * Day this block runs on, on a day-split ZKT competition. WCIF has no such
	 * concept, so it is absent on every WCA competition and the schedule simply
	 * reads by date there.
	 */
	@Field(() => Int, {nullable: true})
	dayIndex?: number;

	@Field({nullable: true})
	dayLabel?: string;

	/**
	 * ZKT rounds only: the parts the client needs to name the block in the
	 * viewer's language. `name` stays as a ready Turkish label for older clients.
	 */
	@Field(() => Int, {nullable: true})
	roundNumber?: number;

	@Field({nullable: true})
	isFinal?: boolean;

	/** ZKT Dual Chance round: the chance this block runs. */
	@Field(() => Int, {nullable: true})
	chance?: number;
}

@ObjectType()
export class WcaLiveScheduleRoom {
	@Field()
	name: string;

	@Field({nullable: true})
	color?: string;

	@Field(() => [WcaLiveScheduleActivity])
	activities: WcaLiveScheduleActivity[];
}

@ObjectType()
export class WcaLiveScheduleVenue {
	@Field()
	name: string;

	@Field(() => [WcaLiveScheduleRoom])
	rooms: WcaLiveScheduleRoom[];
}

@ObjectType()
export class WcaLiveRecord {
	@Field()
	type: string;

	@Field()
	tag: string;

	@Field()
	eventId: string;

	@Field()
	eventName: string;

	@Field(() => Int)
	attemptResult: number;

	@Field()
	personName: string;

	@Field({nullable: true})
	personCountryIso2?: string;

	@Field(() => Int, {nullable: true})
	roundNumber?: number;
}

@ObjectType()
export class WcaRecentRecord {
	@Field()
	id: string;

	@Field()
	tag: string;

	@Field()
	type: string;

	@Field()
	eventId: string;

	@Field()
	eventName: string;

	@Field(() => Int)
	attemptResult: number;

	@Field()
	personName: string;

	@Field({nullable: true})
	personCountryIso2?: string;

	@Field({nullable: true})
	competitionId?: string;

	@Field()
	competitionName: string;

	@Field(() => Int, {nullable: true})
	roundNumber?: number;
}

@ObjectType()
export class WcaLivePodiumEntry {
	@Field(() => Int, {nullable: true})
	ranking?: number;

	@Field()
	personName: string;

	@Field({nullable: true})
	personCountryIso2?: string;

	@Field(() => Int)
	best: number;

	@Field(() => Int)
	average: number;

	@Field({nullable: true})
	singleRecordTag?: string;

	@Field({nullable: true})
	averageRecordTag?: string;
}

@ObjectType()
export class WcaLivePodium {
	@Field()
	eventId: string;

	@Field()
	eventName: string;

	@Field()
	sortBy: string;

	@Field(() => [WcaLivePodiumEntry])
	entries: WcaLivePodiumEntry[];
}

@ObjectType()
export class WcaLiveCompetitionOverview {
	@Field()
	compId: string;

	@Field()
	name: string;

	@Field(() => [WcaLiveEventInfo])
	events: WcaLiveEventInfo[];

	@Field(() => [WcaLiveScheduleVenue])
	schedule: WcaLiveScheduleVenue[];

	@Field(() => [WcaLiveRecord])
	records: WcaLiveRecord[];

	@Field(() => [WcaLivePodium])
	podiums: WcaLivePodium[];
}

@ObjectType()
export class WcaLiveRoundResults {
	@Field()
	roundActivityCode: string;

	@Field()
	roundName: string;

	@Field()
	active: boolean;

	@Field()
	finished: boolean;

	@Field(() => Int)
	numberOfAttempts: number;

	@Field()
	sortBy: string;

	/** ZKT Dual Chance round (see WcaRound.dualChance). */
	@Field({nullable: true})
	dualChance?: boolean;

	@Field(() => [WcaLiveResult])
	results: WcaLiveResult[];
}

// All round results for a competitor (for in-app display)
@ObjectType()
export class WcaLiveCompetitorResultEntry {
	@Field()
	eventId: string;

	@Field()
	eventName: string;

	@Field(() => Int)
	roundNumber: number;

	@Field()
	roundName: string;

	@Field(() => Int, {nullable: true})
	ranking?: number;

	@Field(() => Int)
	best: number;

	@Field(() => Int)
	average: number;

	@Field(() => [WcaLiveAttempt])
	attempts: WcaLiveAttempt[];

	@Field({nullable: true})
	singleRecordTag?: string;

	@Field({nullable: true})
	averageRecordTag?: string;

	@Field()
	advancing: boolean;

	@Field()
	advancingQuestionable: boolean;

	@Field(() => WcaLiveFormat, {nullable: true})
	format?: WcaLiveFormat;
}

@ObjectType()
export class WcaLiveCompetitorResults {
	@Field()
	personName: string;

	@Field({nullable: true})
	personWcaId?: string;

	@Field({nullable: true})
	personCountryIso2?: string;

	@Field(() => [WcaLiveCompetitorResultEntry])
	results: WcaLiveCompetitorResultEntry[];
}


// Root type
@ObjectType()
export class WcaCompetitionDetail {
	@Field()
	competitionId: string;

	@Field()
	competitionName: string;

	@Field({nullable: true})
	myWcaId?: string;

	@Field(() => Int, {nullable: true})
	myRegistrantId?: number;

	@Field({nullable: true})
	myRegistrationStatus?: string;

	@Field(() => [String])
	myRegisteredEvents: string[];

	/**
	 * Days of a day-split ZKT competition; empty on everything else. Non-empty
	 * means each competitor attends exactly ONE of these days.
	 */
	@Field(() => [WcaCompetitionDay], {nullable: true})
	days?: WcaCompetitionDay[];

	/** The viewer's own day on such a competition. */
	@Field({nullable: true})
	myDayLabel?: string;

	// Tab 1
	@Field(() => [WcaCompetitor])
	competitors: WcaCompetitor[];

	// Tab 2
	@Field(() => [WcaEventDetail])
	events: WcaEventDetail[];

	// Tab 3
	@Field(() => [WcaScheduleDay])
	schedule: WcaScheduleDay[];

	// Tab 4
	@Field(() => [WcaRankingRow])
	allPersonalBests: WcaRankingRow[];

	// WCA Live
	@Field({nullable: true})
	wcaLiveCompId?: string;

	@Field(() => [WcaLiveCompetitor])
	wcaLiveCompetitors: WcaLiveCompetitor[];

	@Field(() => [WcaLiveRoundMapping])
	wcaLiveRoundMap: WcaLiveRoundMapping[];

	// Info
	@Field(() => WcaCompetitionInfo)
	info: WcaCompetitionInfo;
}

@InputType()
export class WcaScheduleInput {
	@Field()
	competitionId: string;
}

@InputType()
export class WcaLiveRoundInput {
	@Field()
	competitionId: string;

	@Field()
	liveRoundId: string;
}

@InputType()
export class WcaLiveOverviewInput {
	@Field()
	competitionId: string;
}

@InputType()
export class WcaLiveCompetitorInput {
	@Field()
	competitionId: string;

	@Field()
	personLiveId: string;
}

