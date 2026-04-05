import {Field, ObjectType, Int} from 'type-graphql';

@ObjectType()
export class WcaResult {
	@Field()
	competition_id: string;

	@Field()
	competition_name: string;

	@Field()
	competition_date: string;

	@Field()
	event_id: string;

	@Field()
	round_type_id: string;

	@Field(() => Int)
	pos: number;

	@Field(() => Int)
	best: number;

	@Field(() => Int)
	average: number;

	@Field(() => [Int])
	attempts: number[];

	@Field(() => String, {nullable: true})
	regional_single_record?: string;

	@Field(() => String, {nullable: true})
	regional_average_record?: string;
}
