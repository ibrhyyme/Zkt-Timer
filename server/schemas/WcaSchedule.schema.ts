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

	// Info
	@Field(() => WcaCompetitionInfo)
	info: WcaCompetitionInfo;
}

@InputType()
export class WcaScheduleInput {
	@Field()
	competitionId: string;
}
