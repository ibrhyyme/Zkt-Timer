import { ObjectType, Field, InputType, Int } from 'type-graphql';

@ObjectType()
export class OllcpStatType {
	@Field()
	alg_id: string;

	@Field(() => Int)
	correct: number;

	@Field(() => Int)
	total: number;
}

@InputType()
export class OllcpStatInput {
	@Field()
	alg_id: string;

	@Field(() => Int)
	correct: number;

	@Field(() => Int)
	total: number;
}
