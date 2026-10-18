import {Field, ObjectType, Int} from 'type-graphql';
import {PublicUserAccount} from './UserAccount.schema';
import {ReportAlgSet} from './AlgSet.schema';

@ObjectType()
export class Report {
	@Field()
	id: string;

	@Field()
	created_by_id: string;

	@Field()
	reason: string;

	@Field()
	reported_user_id: string;

	@Field()
	resolved_at: Date;

	@Field()
	created_at: Date;

	@Field(() => PublicUserAccount)
	created_by?: PublicUserAccount;

	@Field(() => PublicUserAccount)
	reported_user?: PublicUserAccount;

	@Field({nullable: true})
	alg_set_id?: string;

	/** The trainer algorithm set the report is about; null for a profile report or a deleted set. */
	@Field(() => ReportAlgSet, {nullable: true})
	alg_set?: ReportAlgSet;
}

@ObjectType()
export class ReportSummary {
	@Field(() => PublicUserAccount)
	user?: PublicUserAccount;

	@Field(() => Int)
	count: number;

	@Field()
	first_report: Date;

	@Field()
	last_report: Date;

	@Field(() => [Report])
	reports?: Report[];
}
