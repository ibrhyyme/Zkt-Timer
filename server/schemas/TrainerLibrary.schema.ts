import {Field, Int, ObjectType} from 'type-graphql';

@ObjectType()
export class TrainerLibraryEntry {
	@Field()
	name: string;

	@Field()
	algorithm: string;

	@Field({nullable: true})
	setup?: string;

	/** How many alternatives the case has; their texts need trainerLibraryAlternatives. */
	@Field(() => Int)
	alternativeCount: number;
}

@ObjectType()
export class TrainerLibrarySubset {
	@Field()
	subset: string;

	@Field(() => [TrainerLibraryEntry])
	algorithms: TrainerLibraryEntry[];
}

@ObjectType()
export class TrainerLibraryCategory {
	@Field()
	category: string;

	@Field(() => [TrainerLibrarySubset])
	subsets: TrainerLibrarySubset[];
}

@ObjectType()
export class TrainerLibrary {
	/** Changes whenever the served file changes; the client keys its cache on it. */
	@Field()
	version: string;

	/** Null when the client already holds this version. */
	@Field(() => [TrainerLibraryCategory], {nullable: true})
	categories?: TrainerLibraryCategory[];
}

@ObjectType()
export class TrainerCaseAlternatives {
	@Field()
	name: string;

	@Field(() => [String])
	alternatives: string[];
}

@ObjectType()
export class TrainerLibraryAlternatives {
	@Field()
	version: string;

	@Field()
	category: string;

	@Field(() => [TrainerCaseAlternatives])
	cases: TrainerCaseAlternatives[];
}
