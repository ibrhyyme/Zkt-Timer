import {Field, InputType, Int, ObjectType} from 'type-graphql';
import PaginatedResponse from './Pagination.schema';

@ObjectType()
export class TrainerAlternative {
	@Field()
	id: string;

	@Field()
	category: string;

	@Field()
	subset: string;

	@Field()
	case_name: string;

	@Field()
	algorithm: string;

	@Field()
	original_input: string;

	@Field({nullable: true})
	setup?: string;

	@Field({nullable: true})
	ll_pattern?: string;

	@Field()
	user_id: string;

	@Field()
	created_at: Date;
}

@ObjectType()
export class PaginatedTrainerAlternatives extends PaginatedResponse(TrainerAlternative) {}

@InputType()
export class TrainerAlternativeCreateInput {
	@Field({nullable: false})
	category: string;

	@Field({nullable: false})
	subset: string;

	@Field({nullable: false})
	case_name: string;

	@Field({nullable: false})
	algorithm: string;

	@Field({nullable: false})
	original_input: string;

	@Field({nullable: true})
	setup?: string;

	@Field({nullable: true})
	ll_pattern?: string;
}
