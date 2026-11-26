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

	/** The source's own spelling of the main algorithm, shown under it (FTO: Wegner's notation). */
	@Field({nullable: true})
	notation?: string;
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

	/** The source's own spelling of each alternative, same order ('' where it has none). */
	@Field(() => [String], {nullable: true})
	notations?: string[];
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
