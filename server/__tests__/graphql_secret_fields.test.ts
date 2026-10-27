import 'reflect-metadata';
import fs from 'fs';
import path from 'path';
import {
	buildSchema as buildSdlSchema,
	GraphQLSchema,
	isInterfaceType,
	isObjectType,
	parse,
	validate,
} from 'graphql';

// Secrets that must never be selectable through GraphQL, by anyone. Integration's
// OAuth tokens were once a @Field on a type reachable from every public user
// (solveByShareCode, solve(id), profile, userSearch, leaderboards, wcaRecords), which
// let an anonymous client read every linked WCA / ZKT account's credentials.
const FORBIDDEN_FIELDS = ['auth_token', 'refresh_token', 'password'];

function findForbiddenFields(schema: GraphQLSchema): string[] {
	const hits: string[] = [];
	for (const type of Object.values(schema.getTypeMap())) {
		if (type.name.startsWith('__')) continue;
		if (!isObjectType(type) && !isInterfaceType(type)) continue;
		for (const fieldName of Object.keys(type.getFields())) {
			if (FORBIDDEN_FIELDS.includes(fieldName) || /secret/i.test(fieldName)) {
				hits.push(`${type.name}.${fieldName}`);
			}
		}
	}
	return hits;
}

// The exact shapes an attacker would send. Each must fail validation.
const LEAK_QUERIES = [
	'query { solveByShareCode(shareCode: "x") { user { integrations { service_name auth_token refresh_token } } } }',
	'query { solve(id: "x") { user { integrations { auth_token } } } }',
	'query { profile(username: "x") { user { integrations { refresh_token } } } }',
	'query { userSearch(pageArgs: {page: 0, pageSize: 25, searchQuery: ""}) { items { integrations { auth_token } } } }',
	'query { wcaRecords(userId: "x") { integration { auth_token refresh_token } } }',
	'query { integrations { auth_token refresh_token } }',
	'query { me { integrations { auth_token } } }',
];

function expectLeakQueriesRejected(schema: GraphQLSchema) {
	for (const q of LEAK_QUERIES) {
		const errors = validate(schema, parse(q));
		const messages = errors.map((e) => e.message).join('\n');
		expect(messages).toMatch(/Cannot query field "(auth_token|refresh_token)" on type "Integration"/);
	}
}

describe('GraphQL never exposes secrets', () => {
	it('the committed schema.graphql (codegen input) has no secret fields', () => {
		const sdl = fs.readFileSync(path.join(__dirname, '..', '..', 'schema.graphql'), 'utf8');
		const schema = buildSdlSchema(sdl);
		expect(findForbiddenFields(schema)).toEqual([]);
		expectLeakQueriesRejected(schema);
	});

	it('the live schema built from the type-graphql classes and legacy type defs has no secret fields', async () => {
		/* eslint-disable @typescript-eslint/no-var-requires */
		const {buildSchema} = require('type-graphql');
		const {mergeSchemas} = require('@graphql-tools/schema');
		const {baseScalars} = require('../graphql');
		const resolverList = require('../resolvers/_resolvers');
		const schemaList = require('../schemas/_schemas');
		const models = require('../api/_index');
		const {customAuthChecker} = require('../middlewares/auth');
		/* eslint-enable @typescript-eslint/no-var-requires */

		// Same assembly as server/app.ts and scripts/emit-graphql-schema.ts.
		const gqlTypes: string[] = [];
		const gqlQueries: string[] = [];
		const gqlMutations: string[] = [];
		const parseList = (l: {[key: string]: any}) => {
			for (const key of Object.keys(l)) {
				const model = l[key];
				if (!model || typeof model !== 'object') continue;
				if (!model.gqlType && !model.gqlQuery && !model.gqlMutation && !model.queryActions && !model.mutateActions) {
					parseList(model);
					continue;
				}
				gqlTypes.push(model.gqlType || '');
				gqlQueries.push(model.gqlQuery || '');
				gqlMutations.push(model.gqlMutation || '');
			}
		};
		parseList(models);

		const newSchema = await buildSchema({
			resolvers: Object.values(resolverList),
			orphanedTypes: Object.values(schemaList),
			authChecker: customAuthChecker,
			nullableByDefault: true,
			validate: {forbidUnknownValues: false},
		});
		const merged: GraphQLSchema = mergeSchemas({
			schemas: [newSchema],
			typeDefs: `
				${baseScalars}
				${gqlTypes.join('\n')}
				type Query { ${gqlQueries.join('\n')} }
				type Mutation { ${gqlMutations.join('\n')} }
			`,
		});

		expect(findForbiddenFields(merged)).toEqual([]);
		expectLeakQueriesRejected(merged);
	}, 120000);
});
