import {Arg, Authorized, Ctx, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import {TrainerLibrary, TrainerLibraryAlternatives} from '../schemas/TrainerLibrary.schema';
import AppGraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {checkRateLimit} from '../services/rate_limit';
import {logger} from '../services/logger';
import {getTrainerLibrary} from '../util/trainer_library';
import {ALG_SET_RATE_LIMITS} from '../../shared/trainer/alg_sets';

const MAX_VERSION_LENGTH = 64;
const MAX_CATEGORY_LENGTH = 40;

function rateLimited(): AppGraphQLError {
	return new AppGraphQLError(ErrorCode.RATE_LIMITED, 'Too many trainer library requests', {
		i18nKey: 'alg_set_errors.rate_limited',
	});
}

@Resolver()
export class TrainerLibraryResolver {
	/**
	 * Every case's main algorithm and setup, for anyone (the trainer works signed out).
	 * A client that already holds `knownVersion` gets only the version back.
	 */
	@Query(() => TrainerLibrary)
	async trainerLibrary(
		@Ctx() context: GraphQLContext,
		@Arg('knownVersion', {nullable: true}) knownVersion?: string
	): Promise<TrainerLibrary> {
		const library = getTrainerLibrary();
		if (typeof knownVersion === 'string' && knownVersion.length <= MAX_VERSION_LENGTH && knownVersion === library.version) {
			return {version: library.version, categories: null};
		}

		const rule = ALG_SET_RATE_LIMITS.LIBRARY;
		const limit = await checkRateLimit(`trainer_library:full:${context.ipAddress}`, rule.max, rule.windowSeconds, {
			failOpen: true,
		});
		if (!limit.allowed) {
			logger.warn('Trainer library rate limit', {ip: context.ipAddress, count: limit.count});
			throw rateLimited();
		}

		return {version: library.version, categories: library.mains};
	}

	/** One category's alternatives, signed-in users only. */
	@Authorized([Role.LOGGED_IN])
	@Query(() => TrainerLibraryAlternatives)
	async trainerLibraryAlternatives(
		@Ctx() context: GraphQLContext,
		@Arg('category') category: string
	): Promise<TrainerLibraryAlternatives> {
		const library = getTrainerLibrary();
		if (typeof category !== 'string' || category.length > MAX_CATEGORY_LENGTH || !library.alternatives.has(category)) {
			throw new AppGraphQLError(ErrorCode.NOT_FOUND, 'Unknown trainer category');
		}

		const {user} = context;
		for (const [scope, rule] of [
			['hour', ALG_SET_RATE_LIMITS.LIBRARY_ALTERNATIVES_HOUR],
			['day', ALG_SET_RATE_LIMITS.LIBRARY_ALTERNATIVES_DAY],
		] as const) {
			const limit = await checkRateLimit(`trainer_library:alts:${scope}:${user.id}`, rule.max, rule.windowSeconds, {
				failOpen: true,
			});
			if (!limit.allowed) {
				logger.warn('Trainer library alternatives rate limit', {userId: user.id, scope, count: limit.count});
				throw rateLimited();
			}
		}

		return {version: library.version, category, cases: library.alternatives.get(category)};
	}
}
