import {Field, ObjectType} from 'type-graphql';

/**
 * Result of signing in with a Zeka Kupu Turkiye account.
 *
 * Mirrors WcaOAuthResult rather than reusing it: the two providers hand back
 * different identities (a WCA id versus a ZKT id + member number), and folding
 * them into one type would leave every consumer guessing which half is filled.
 */
@ObjectType()
export class ZktOAuthResult {
	@Field()
	success: boolean;

	/** No Zkt-Timer account yet — the client collects a username and completes. */
	@Field()
	needsUsername: boolean;

	@Field({nullable: true})
	zktName?: string;

	@Field({nullable: true})
	zktEmail?: string;

	/** Competition identity; null for a member who has not competed yet. */
	@Field({nullable: true})
	zktId?: string;

	@Field({nullable: true})
	zktMemberNo?: number;

	// Native shell auth: session JWT in the response body for the local bundle.
	@Field({nullable: true})
	sessionToken?: string;
}
