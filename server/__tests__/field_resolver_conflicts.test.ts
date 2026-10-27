import 'reflect-metadata';

/**
 * A field must come either from a @Field on the object type class or from a @FieldResolver in
 * a resolver class, never from both.
 *
 * Under ts-node (`yarn server`) the pair works: the resolver class wins. The production server
 * is compiled by babel with legacy decorators (prod.babelrc), which hands a property decorator
 * a descriptor, and type-graphql then registers every class property @Field as a resolver of
 * its own that returns the stored value. That one replaced the resolver class's:
 * AlgSet.items came back null on the live site (every set opened empty while its count said
 * otherwise), Integration's privacy-gated WCA counts went out to everyone, and Solve.cube was
 * always null. Dev showed none of it.
 */
describe('field resolvers are not shadowed by a @Field of the same name', () => {
	it('no class property @Field shares its name with a resolver class @FieldResolver', () => {
		/* eslint-disable @typescript-eslint/no-var-requires */
		require('../resolvers/_resolvers');
		require('../schemas/_schemas');
		const {getMetadataStorage} = require('type-graphql');
		/* eslint-enable @typescript-eslint/no-var-requires */

		const storage = getMetadataStorage();
		const conflicts: string[] = [];

		for (const fieldResolver of storage.fieldResolvers) {
			if (fieldResolver.kind !== 'external') continue;
			const resolverClass = storage.resolverClasses.find((r: any) => r.target === fieldResolver.target);
			const objectType = resolverClass?.getObjectType?.();
			if (!objectType) continue;

			for (const field of storage.fields) {
				if (field.name !== fieldResolver.methodName) continue;
				const sameClass = field.target === objectType || objectType.prototype instanceof field.target;
				if (sameClass) conflicts.push(`${objectType.name}.${field.name} (${fieldResolver.target.name})`);
			}
		}

		expect(conflicts).toEqual([]);
	}, 120000);
});
