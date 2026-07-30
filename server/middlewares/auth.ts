import {AuthChecker} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {isProEnabled} from '../lib/pro';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';

export enum Role {
	ADMIN = 'ADMIN',
	MOD = 'MOD',
	LOGGED_IN = 'LOGGED_IN',
	PRO = 'PRO',
	PREMIUM = 'PREMIUM',
	DOCUMENT_OWNER = 'DOCUMENT_OWNER',
}

export const customAuthChecker: AuthChecker<GraphQLContext> = ({root, args, context, info}, roles: Role[]) => {
	let passed = true;

	// `@Authorized()` with no roles means "logged in" (type-graphql's own
	// convention). Without this the loop below never runs, `passed` stays true and
	// the guard lets an anonymous request straight into the resolver — where it
	// crashes on `ctx.user.id` and surfaces as an opaque 500 instead of "please
	// sign in". Ten queries were guarded this way.
	if (roles.length === 0) {
		if (!context.user) {
			// Thrown rather than returned so the message is ours: type-graphql's own
			// refusal is an English sentence the competitor cannot act on.
			throw new GraphQLError(
				ErrorCode.FORBIDDEN,
				'Bu sayfayı görmek için giriş yapmalısın.'
			);
		}
		return true;
	}

	for (const role of roles) {
		switch (role) {
			case Role.LOGGED_IN: {
				passed = passed && !!context.user;
				break;
			}
			case Role.PRO: {
				// When Pro is disabled, allow all users to access Pro-only content
				if (!isProEnabled()) {
					passed = passed && true;
				} else {
					passed = passed && (context?.user?.is_pro || context?.user?.is_premium);
				}
				break;
			}
			case Role.PREMIUM: {
				if (!isProEnabled()) {
					passed = passed && true;
				} else {
					passed = passed && context?.user?.is_premium;
				}
				break;
			}
			case Role.MOD: {
				passed = passed && (context?.user?.mod || context?.user?.admin);
				break;
			}
			case Role.ADMIN: {
				passed = passed && context?.user?.admin;
				break;
			}
		}
	}

	return passed;
};
