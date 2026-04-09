import {ObjectType, Field, InputType, Int} from 'type-graphql';

// Tab 3 - Schedule (mevcut)
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

@ObjectType()
export class WcaCompetitor {
	@Field()
	name: string;

	@Field({nullable: true})
	wcaId?: string;

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

	@Field(() => [WcaGroup])
	groups: WcaGroup[];
}

@ObjectType()
export class WcaEventDetail {
	@Field()
	eventId: string;

	@Field()
	eventName: string;

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
	@Field()
	wcaId: string;

	@Field()
	liveId: string;
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

	@Field(() => [WcaLiveResult])
	results: WcaLiveResult[];
}

// Bir yarismacinin tum round sonuclari (in-app gosterim icin)
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

	@Field({nullable: true})
	myRegistrationStatus?: string;

	@Field(() => [String])
	myRegisteredEvents: string[];

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

