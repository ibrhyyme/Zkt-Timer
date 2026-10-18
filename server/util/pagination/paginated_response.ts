import {PaginationArgs, PaginationOutput} from '../../schemas/Pagination.schema';
import {getPrisma} from '../../database';
import {logger} from '../../services/logger';

export interface PaginatedRequestInput {
	paginationArgs: PaginationArgs;
	tableName: string;

	// Note: The "where" field will be used to query for the total count as well
	prismaPayload: {[key: string]: any};
}

export async function getPaginatedResponseTotalCount(input: PaginatedRequestInput): Promise<number> {
	const {prismaPayload, tableName} = input;

	const countPayload: any = {};
	if (prismaPayload.where) {
		countPayload.where = prismaPayload.where;
	}

	return await getPrisma()[tableName].count(countPayload);
}

export async function getPaginatedResponse<T>(input: PaginatedRequestInput): Promise<PaginationOutput<T>> {
	const {paginationArgs, tableName, prismaPayload} = input;
	const {page, pageSize} = paginationArgs;

	prismaPayload.skip = page * pageSize;
	prismaPayload.take = pageSize + 1;

	// Only the shape goes to the logs: the search term and the where clause carry what an
	// admin typed (emails, names), and logs are read far more widely than the database.
	const logContext = {tableName, page, pageSize};

	try {
		logger.info(`Fetching paginated data for table: ${tableName}`, logContext);

		const [total, items] = await Promise.all([
			getPaginatedResponseTotalCount(input),
			getPrisma()[tableName].findMany(prismaPayload),
		]);

		logger.info(`Successfully fetched paginated data`, {
			tableName,
			totalCount: total,
			itemsLength: items.length
		});

		let hasMore = false;
		if (items.length > pageSize) {
			items.pop();
			hasMore = true;
		}

		return {
			items,
			total,
			hasMore,
		};
	} catch (e) {
		logger.error(`Could not fetch paginated result.`, {
			...logContext,
			error: e,
			errorMessage: e.message,
			errorStack: e.stack
		});

		return null;
	}
}
