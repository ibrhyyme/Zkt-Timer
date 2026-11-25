import {Readable} from 'stream';
import {makeExecutableSchema} from '@graphql-tools/schema';
import GraphQLError from '../graphql_error';
import {FileUpload, GraphQLUpload} from '../graphql_upload';
import {createGraphQLYoga} from '../graphql_yoga';
import {ErrorCode, ErrorMessage} from '../../constants/errors';

jest.mock('../../services/logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn()}}));

// The /graphql contract the clients depend on, checked against the production Yoga
// setup (createGraphQLYoga, as server/app.ts uses it) over a small schema: status codes,
// error masking, limits, the banned-user 400 and the Upload scalar's value shape.

async function readAll(stream: Readable): Promise<Buffer> {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) chunks.push(Buffer.from(chunk));
	return Buffer.concat(chunks);
}

const schema = makeExecutableSchema({
	typeDefs: /* GraphQL */ `
		scalar Upload
		type UploadResult {
			filename: String
			mimetype: String
			content: String
		}
		type Node {
			id: String
			child: Node
		}
		type Query {
			ok: String
			node: Node
			short(s: String): String
			notFound: String
			localized: String
			crash: String
			denied: String
		}
		type Mutation {
			upload(file: Upload): UploadResult
		}
	`,
	resolvers: {
		Upload: GraphQLUpload,
		Query: {
			ok: () => 'yes',
			node: () => ({id: 'n'}),
			short: (_: unknown, {s}: {s: string}) => s,
			notFound: () => {
				throw new GraphQLError(ErrorCode.NOT_FOUND);
			},
			localized: () => {
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'Too big', {
					i18nKey: 'upload.file_too_large',
					i18nValues: {size: 40},
					rejected: ['oll::1', 7],
					retry_after: 12.6,
					secret: 'internal',
				});
			},
			crash: () => {
				throw new Error('db password in message');
			},
			// type-graphql's auth checker throws a plain Error like this one
			denied: () => {
				throw new Error("Access denied! You don't have permission for this action!");
			},
		},
		Mutation: {
			upload: async (_: unknown, {file}: {file: Promise<FileUpload> | FileUpload}) => {
				const {filename, mimetype, createReadStream} = await file;
				const content = (await readAll(createReadStream())).toString('utf8');
				return {filename, mimetype, content};
			},
		},
	},
});

function buildYoga() {
	return createGraphQLYoga<Record<string, any>, Record<string, any>>({
		schema,
		isDev: false,
		maxUploadFileBytes: 64,
		context: ({request}) => {
			if (request.headers.get('x-banned') === '1') {
				throw new GraphQLError(ErrorCode.FORBIDDEN, ErrorMessage.BANNED, {http: {status: 400}});
			}
			return {};
		},
	});
}

async function post(body: string, headers: Record<string, string> = {}) {
	const yoga = buildYoga();
	const res = await yoga.fetch('http://localhost/graphql', {
		method: 'POST',
		headers: {'content-type': 'application/json', accept: '*/*', ...headers},
		body,
	});
	return {status: res.status, json: await res.json()};
}

function multipart(operations: object, map: object, files: {field: string; name: string; type: string; data: string}[]) {
	const boundary = '----zkt-test-boundary';
	const parts: string[] = [];
	const field = (name: string, value: string) =>
		parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
	field('operations', JSON.stringify(operations));
	field('map', JSON.stringify(map));
	for (const f of files) {
		parts.push(
			`--${boundary}\r\nContent-Disposition: form-data; name="${f.field}"; filename="${f.name}"\r\nContent-Type: ${f.type}\r\n\r\n${f.data}\r\n`
		);
	}
	parts.push(`--${boundary}--\r\n`);
	return {body: parts.join(''), contentType: `multipart/form-data; boundary=${boundary}`};
}

describe('/graphql contract under Yoga', () => {
	it('answers a plain query with 200', async () => {
		const {status, json} = await post(JSON.stringify({query: '{ ok }'}));
		expect(status).toBe(200);
		expect(json).toEqual({data: {ok: 'yes'}});
	});

	it('delivers an expected error with its code and default message', async () => {
		const {status, json} = await post(JSON.stringify({query: '{ notFound }'}));
		expect(status).toBe(200);
		expect(json.errors[0]).toMatchObject({
			message: ErrorMessage.RESOURCE_NOT_FOUND,
			path: ['notFound'],
			extensions: {code: 'NOT_FOUND'},
		});
	});

	it('forwards only whitelisted extensions', async () => {
		const {json} = await post(JSON.stringify({query: '{ localized }'}));
		expect(json.errors[0].message).toBe('Too big');
		expect(json.errors[0].extensions).toEqual({code: 'BAD_INPUT', i18nKey: 'upload.file_too_large', retry_after: 13});
	});

	it.each(['crash', 'denied'])('masks an error without a code (%s)', async (field) => {
		const {status, json} = await post(JSON.stringify({query: `{ ${field} }`}));
		expect(status).toBe(200);
		expect(json.data).toEqual({[field]: null});
		expect(json.errors[0].message).toMatch(/^Sunucu hatası oluştu\. Hata kodu: [0-9a-f]{12}$/);
		expect(json.errors[0].extensions).toEqual({code: 'INTERNAL_SERVER_ERROR', traceId: expect.any(String)});
		expect(JSON.stringify(json)).not.toMatch(/password|Access denied|stack/);
	});

	it('answers a banned user with 400 FORBIDDEN, as Apollo 2 did', async () => {
		const {status, json} = await post(JSON.stringify({query: '{ ok }'}), {'x-banned': '1'});
		expect(status).toBe(400);
		expect(json.errors[0]).toMatchObject({message: ErrorMessage.BANNED, extensions: {code: 'FORBIDDEN'}});
		expect(json.errors[0].extensions.http).toBeUndefined();
	});

	it('answers a validation error with 400 GRAPHQL_VALIDATION_FAILED', async () => {
		const {status, json} = await post(JSON.stringify({query: '{ noSuchField }'}));
		expect(status).toBe(400);
		expect(json.errors[0].extensions).toEqual({code: 'GRAPHQL_VALIDATION_FAILED'});
	});

	it('answers a syntax error with 400 GRAPHQL_PARSE_FAILED', async () => {
		const {status, json} = await post(JSON.stringify({query: '{ '}));
		expect(status).toBe(400);
		expect(json.errors[0].extensions).toEqual({code: 'GRAPHQL_PARSE_FAILED'});
	});

	it('answers a wrongly typed variable with 400 BAD_USER_INPUT', async () => {
		const {status, json} = await post(JSON.stringify({query: 'query($s: String) { short(s: $s) }', variables: {s: 5}}));
		expect(status).toBe(400);
		expect(json.errors[0].message).toMatch(/String cannot represent a non string value/);
		expect(json.errors[0].extensions).toEqual({code: 'BAD_USER_INPUT'});
	});

	it('rejects a query deeper than 11 levels', async () => {
		const deep = '{ node ' + '{ child '.repeat(11) + '{ id }' + ' }'.repeat(11) + ' }';
		const {status, json} = await post(JSON.stringify({query: deep}));
		expect(status).toBe(400);
		expect(json.errors[0].message).toMatch(/exceeds maximum operation depth of 11/);
	});

	it('rejects an over-complex query before resolving it', async () => {
		const wide = '{ ' + Array.from({length: 1600}, (_, i) => `a${i}: ok`).join(' ') + ' }';
		const {status, json} = await post(JSON.stringify({query: wide}));
		expect(status).toBe(400);
		expect(json).not.toHaveProperty('data');
		expect(json.errors[0]).toMatchObject({message: 'Query too complex: 1600 (max 1500)', extensions: {code: 'BAD_INPUT'}});
	});

	it('blocks introspection in production', async () => {
		const {status, json} = await post(JSON.stringify({query: '{ __schema { queryType { name } } }'}));
		expect(status).toBe(400);
		expect(json.errors[0].message).toMatch(/introspection/i);
	});

	it('hands resolvers the graphql-upload shape for a multipart file', async () => {
		const {body, contentType} = multipart(
			{query: 'mutation($file: Upload) { upload(file: $file) { filename mimetype content } }', variables: {file: null}},
			{0: ['variables.file']},
			[{field: '0', name: 'avatar.png', type: 'image/png', data: 'pixels'}]
		);
		const yoga = buildYoga();
		const res = await yoga.fetch('http://localhost/graphql', {
			method: 'POST',
			headers: {'content-type': contentType, accept: '*/*'},
			body,
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({data: {upload: {filename: 'avatar.png', mimetype: 'image/png', content: 'pixels'}}});
	});

	it('refuses a file over the multipart size limit with 413', async () => {
		const {body, contentType} = multipart(
			{query: 'mutation($file: Upload) { upload(file: $file) { filename } }', variables: {file: null}},
			{0: ['variables.file']},
			[{field: '0', name: 'big.png', type: 'image/png', data: 'x'.repeat(200)}]
		);
		const yoga = buildYoga();
		const res = await yoga.fetch('http://localhost/graphql', {
			method: 'POST',
			headers: {'content-type': contentType, accept: '*/*'},
			body,
		});
		expect(res.status).toBe(413);
	});

	it('accepts a file above the Yoga default 25 MB body cap with the production limits', async () => {
		const size = 30 * 1024 * 1024;
		const {body, contentType} = multipart(
			{query: 'mutation($file: Upload) { upload(file: $file) { filename } }', variables: {file: null}},
			{0: ['variables.file']},
			[{field: '0', name: 'clip.mp4', type: 'video/mp4', data: 'v'.repeat(size)}]
		);
		const yoga = createGraphQLYoga<Record<string, any>, Record<string, any>>({schema, isDev: false, context: () => ({})});
		const res = await yoga.fetch('http://localhost/graphql', {
			method: 'POST',
			headers: {'content-type': contentType, accept: '*/*', 'content-length': String(Buffer.byteLength(body))},
			body,
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({data: {upload: {filename: 'clip.mp4'}}});
	});

	it('rejects a non-file value for Upload', async () => {
		const {json} = await post(
			JSON.stringify({query: 'mutation($file: Upload) { upload(file: $file) { filename } }', variables: {file: 'not-a-file'}})
		);
		expect(json.errors[0].message).toMatch(/Upload value invalid/);
	});
});
