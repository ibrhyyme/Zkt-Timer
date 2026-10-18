import {Arg, Ctx, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {PaginationArgsInput} from '../schemas/Pagination.schema';
import {getPaginatedResponse, PaginatedRequestInput} from '../util/pagination/paginated_response';
import {PaginatedUserAccounts, PublicUserAccount} from '../schemas/UserAccount.schema';
import {publicUserInclude} from '../models/user_account';
import {checkRateLimit} from '../services/rate_limit';
import {extractIp} from '../util/request';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';

// Public, login-free directory search. It used to accept an empty query and 100 rows a
// page with no throttle, which made it a one-loop dump of every account. A lookup now
// needs a real search term, gets a short page, and is throttled per IP.
export const USER_SEARCH_MIN_QUERY = 2;
export const USER_SEARCH_MAX_PAGE_SIZE = 25;
export const USER_SEARCH_RATE_LIMIT = {max: 30, windowSeconds: 60};

@Resolver()
export class UserSearchResolver {
	@Query(() => PaginatedUserAccounts)
	async userSearch(
		@Ctx() context: GraphQLContext,
		@Arg('pageArgs', () => PaginationArgsInput) pageArgs: PaginationArgsInput
	): Promise<PaginatedUserAccounts> {
		const term = (pageArgs?.searchQuery || '').trim();
		if (term.length < USER_SEARCH_MIN_QUERY) {
			return {items: [], total: 0, hasMore: false};
		}

		const ip = context?.req ? extractIp(context.req) : null;
		if (ip) {
			const limit = await checkRateLimit(
				`user_search:ip:${ip}`,
				USER_SEARCH_RATE_LIMIT.max,
				USER_SEARCH_RATE_LIMIT.windowSeconds
			);
			if (!limit.allowed) {
				throw new GraphQLError(ErrorCode.RATE_LIMITED, 'Çok fazla arama. Lütfen biraz bekleyin.');
			}
		}

		const requestInput: PaginatedRequestInput = {
			paginationArgs: {
				page: Math.max(0, Math.floor(pageArgs?.page || 0)),
				pageSize: Math.min(Math.max(1, pageArgs?.pageSize || USER_SEARCH_MAX_PAGE_SIZE), USER_SEARCH_MAX_PAGE_SIZE),
				searchQuery: term,
			},
			tableName: 'userAccount',
			prismaPayload: {
				where: {
					username: {
						contains: term,
						mode: 'insensitive',
					},
				},
				...publicUserInclude,
			},
		};

		return getPaginatedResponse<PublicUserAccount>(requestInput);
	}
}
