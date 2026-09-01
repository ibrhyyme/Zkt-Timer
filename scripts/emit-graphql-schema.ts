/**
 * Write schema.graphql from the live type-graphql definitions, without booting
 * the HTTP server. Mirrors the schema construction in server/app.ts one to one
 * (type-graphql resolvers merged with the legacy server/api/* type defs), which
 * is otherwise only reachable by starting the dev server.
 *
 *   npx ts-node --transpile-only scripts/emit-graphql-schema.ts
 */
import 'reflect-metadata';
import fs from 'fs';
import {printSchema} from 'graphql';
import {buildSchema} from 'type-graphql';
import {mergeSchemas} from '@graphql-tools/schema';
import {GraphQLUpload} from 'graphql-upload';

import {baseResolvers, baseScalars} from '../server/graphql';
import * as resolverList from '../server/resolvers/_resolvers';
import * as schemaList from '../server/schemas/_schemas';
import * as models from '../server/api/_index';
import {customAuthChecker} from '../server/middlewares/auth';

const gqlTypes: any[] = [];
const gqlQueries: any[] = [];
const gqlMutations: any[] = [];
let gqlMutationActions = {};
let gqlQueryActions = {};

function parseList(l: {[key: string]: any}) {
	for (const key of Object.keys(l)) {
		const model = l[key];

		if (!model.gqlType && !model.gqlQuery && !model.gqlMutation && !model.queryActions && !model.mutateActions) {
			parseList(model);
			continue;
		}

		gqlTypes.push(model.gqlType || '');
		gqlQueries.push(model.gqlQuery || '');
		gqlMutations.push(model.gqlMutation || '');
		gqlMutationActions = {...gqlMutationActions, ...(model.mutateActions || {})};
		gqlQueryActions = {...gqlQueryActions, ...(model.queryActions || {})};
	}
}

(async () => {
	parseList(models);

	const oldTypeDef = `
		${baseScalars}
		${gqlTypes.join('\n')}

		type Query { ${gqlQueries.join('\n')} }
		type Mutation { ${gqlMutations.join('\n')} }
	`;

	const oldResolver = {
		...baseResolvers,
		Upload: GraphQLUpload,
		Query: {...gqlQueryActions},
		Mutation: {...gqlMutationActions},
	};

	const newSchema = await buildSchema({
		resolvers: Object.values(resolverList) as any,
		orphanedTypes: Object.values(schemaList) as any,
		authChecker: customAuthChecker,
		nullableByDefault: true,
		validate: {forbidUnknownValues: false},
	});

	const mergedSchema = mergeSchemas({
		schemas: [newSchema],
		typeDefs: oldTypeDef,
		resolvers: oldResolver,
	});

	fs.writeFileSync('schema.graphql', printSchema(mergedSchema));
	console.log('schema.graphql written');
	process.exit(0);
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
