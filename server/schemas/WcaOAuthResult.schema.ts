import {Field, ObjectType} from 'type-graphql';

@ObjectType()
export class WcaOAuthResult {
	@Field()
	success: boolean;

	@Field()
	needsUsername: boolean;

	@Field({nullable: true})
	wcaName?: string;

	@Field({nullable: true})
	wcaEmail?: string;

	@Field({nullable: true})
	wcaId?: string;

	// Faz 2 native auth: session JWT in the response body for the local-bundle client.
	@Field({nullable: true})
	sessionToken?: string;
}
