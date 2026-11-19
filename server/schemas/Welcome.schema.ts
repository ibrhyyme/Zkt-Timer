import {ObjectType, Field, Int} from 'type-graphql';

@ObjectType()
export class AcquisitionSourceCount {
	@Field()
	source: string;

	@Field(() => Int)
	count: number;
}

/** How the welcome message is doing: how many got it, how many answered, and what they said. */
@ObjectType()
export class WelcomeStats {
	@Field(() => Int)
	sent: number;

	@Field(() => Int)
	answered: number;

	@Field(() => [AcquisitionSourceCount])
	sources: AcquisitionSourceCount[];
}
