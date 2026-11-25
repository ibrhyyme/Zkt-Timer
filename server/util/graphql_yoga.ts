import {GraphQLError as GraphQLBaseError, GraphQLSchema, NoSchemaIntrospectionCustomRule} from 'graphql';
import {createYoga, YogaInitialContext} from 'graphql-yoga';
import {createFetch} from '@whatwg-node/fetch';
import depthLimit from 'graphql-depth-limit';
import {getComplexity, simpleEstimator} from 'graphql-query-complexity';
import GraphQLError from './graphql_error';
import {formatProductionError} from './graphql_format_error';
import {ErrorCode} from '../constants/errors';

// GraphQL DoS protection: reject queries deeper than 11 levels,
// reject if query complexity exceeds 1500 points
const MAX_QUERY_DEPTH = 11;
const MAX_QUERY_COMPLEXITY = 1500;

// Support ticket attachments: 30MB / 4 files. Profile picture + other uploads also count
// toward this limit. 42 MB, not 40: the video background cap is 40 MB and multipart framing
// adds to it, so a file exactly at the cap must still get through to the model's own check,
// which is the one that reports a usable error. Raising this alone is not enough in
// production: nginx's client_max_body_size sits in front of it and rejects the body first.
const MAX_UPLOAD_FILE_BYTES = 42 * 1024 * 1024;
const MAX_UPLOAD_FILES = 4;

const SPEC_400_CODES = new Set(['GRAPHQL_PARSE_FAILED', 'GRAPHQL_VALIDATION_FAILED']);

interface GraphQLYogaOptions<TServerContext, TContext> {
	schema: GraphQLSchema;
	isDev: boolean;
	context: (initial: YogaInitialContext & TServerContext) => Promise<TContext> | TContext;
	/** Tests shrink it; production uses MAX_UPLOAD_FILE_BYTES. */
	maxUploadFileBytes?: number;
}

export function createGraphQLYoga<TServerContext extends Record<string, any>, TContext extends Record<string, any>>({
	schema,
	isDev,
	context,
	maxUploadFileBytes = MAX_UPLOAD_FILE_BYTES,
}: GraphQLYogaOptions<TServerContext, TContext>) {
	return createYoga<TServerContext, TContext>({
		schema,
		graphqlEndpoint: '/graphql',
		graphiql: isDev,
		landingPage: false,
		// cors: false is load-bearing. Yoga otherwise answers with its OWN CORS headers and
		// overrides the global middleware in app.ts, which already decides cross-origin
		// access (native shell included). Same-origin web traffic needs no ACAO at all.
		cors: false,
		// formatProductionError records every masked or rejected error in our own log.
		logging: false,
		maskedErrors: {
			// Dev keeps the raw error and stack. The caller's ENV decides, not NODE_ENV, so a
			// container that ships without NODE_ENV cannot attach stack traces to responses.
			maskError: (error) => (isDev ? (error as Error) : formatProductionError(error)),
		},
		fetchAPI: createFetch({formDataLimits: {fileSize: maxUploadFileBytes, files: MAX_UPLOAD_FILES}}),
		// Yoga caps the whole body at 25 MB by default, below a 40 MB video background. The
		// per-file cap above is the real limit, as it was with graphql-upload; this only leaves
		// room for it (plus the multipart fields). JSON bodies stop at body-parser's 5 MB first.
		maxRequestBodySize: maxUploadFileBytes * MAX_UPLOAD_FILES + 1024 * 1024,
		plugins: [
			{
				onValidate({addValidationRule}) {
					addValidationRule(depthLimit(MAX_QUERY_DEPTH));
					// Block API schema discovery in production.
					if (!isDev) addValidationRule(NoSchemaIntrospectionCustomRule);
				},
				onResultProcess({result}) {
					// Yoga answers syntax and validation errors with 200 when the client accepts
					// application/json, which Apollo Client's */* resolves to. Apollo 2 sent 400,
					// and the clients read a 4xx as the server's verdict on the request.
					for (const single of Array.isArray(result) ? result : [result]) {
						for (const error of (single as {errors?: readonly GraphQLBaseError[]})?.errors || []) {
							const extensions = error.extensions as Record<string, any> | undefined;
							if (extensions && SPEC_400_CODES.has(extensions.code)) {
								extensions.http = {...extensions.http, status: 400, spec: false};
							}
						}
					}
				},
				onExecute({args, setResultAndStopExecution}) {
					// Reject an over-complex query before anything resolves.
					let complexity: number;
					try {
						complexity = getComplexity({
							schema: args.schema,
							operationName: args.operationName,
							query: args.document,
							variables: args.variableValues as Record<string, any>,
							estimators: [simpleEstimator({defaultComplexity: 1})],
						});
					} catch {
						// Complexity calculation error: silently continue, not validation
						return;
					}
					if (complexity > MAX_QUERY_COMPLEXITY) {
						setResultAndStopExecution({
							errors: [
								new GraphQLError(
									ErrorCode.BAD_INPUT,
									`Query too complex: ${complexity} (max ${MAX_QUERY_COMPLEXITY})`,
									{http: {status: 400}}
								),
							],
						});
					}
				},
			},
		],
		context,
	});
}
