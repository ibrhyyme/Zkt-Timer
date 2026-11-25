import {ErrorCode, ErrorMessage} from '../constants/errors';
import {GraphQLError as BaseGraphQLError} from 'graphql';

const defaultErrorMessage = {
	[ErrorCode.FORBIDDEN]: ErrorMessage.FORBIDDEN,
	[ErrorCode.BAD_INPUT]: ErrorMessage.BAD_INPUT,
	[ErrorCode.NOT_FOUND]: ErrorMessage.RESOURCE_NOT_FOUND,
};

// An error the client is meant to see: `code` (and any extra extensions such as
// i18nKey) travel in `extensions`, the shape Apollo's ApolloError produced before.
export default class GraphQLError extends BaseGraphQLError {
	constructor(code: ErrorCode, message?: ErrorMessage | string, extensions?: {[key: string]: any}) {
		super(message || defaultErrorMessage[code], undefined, undefined, undefined, undefined, undefined, {
			...extensions,
			code,
		});
	}
}
