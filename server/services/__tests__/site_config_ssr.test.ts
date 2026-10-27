import fs from 'fs';
import path from 'path';
import {parse, OperationDefinitionNode, FieldNode} from 'graphql';

jest.mock('../../database', () => ({getPrisma: () => ({})}));
jest.mock('../redis', () => ({
	fetchDataFromCache: jest.fn(),
	createRedisKey: () => 'k',
	RedisNamespace: {PRO_DATA: 'pro'},
	setKeyInRedis: jest.fn(),
	deleteKeyInRedis: jest.fn(),
}));
jest.mock('../logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn()}}));

import {toSiteConfigSeed} from '../site_config_ssr';
import {SITE_CONFIG_SCALAR_FIELDS} from '../../../shared/site_config_ssr';

const full: any = {
	id: 'singleton',
	maintenance_mode: false,
	trainer_enabled: true,
	community_enabled: true,
	leaderboards_enabled: true,
	rooms_enabled: true,
	battle_enabled: true,
	messaging_enabled: true,
	presence_enabled: true,
	pro_enabled: true,
	wca_backfill_enabled: false,
	zkt_backfill_enabled: false,
	smart_telemetry_enabled: false,
	// magnet_telemetry_enabled, online_battle_enabled, method_steps_version left out:
	// an older cached config lacks them.
	feature_overrides: {online_battle_enabled: {mode: 'INCLUDE', users: [{id: 'a'}, {id: 'b'}]}},
	featureOverrides: [
		{feature: 'online_battle_enabled', mode: 'INCLUDE', users: [{id: 'a', username: 'ann', email: 'x'}, {id: 'b', username: 'bob'}]},
	],
	updated_at: new Date('2026-10-14T10:00:00.000Z'),
};

describe('toSiteConfigSeed', () => {
	it('carries exactly the fields the client query selects', () => {
		const doc = parse(fs.readFileSync(path.join(__dirname, '../../../client/graphql/queries.graphql'), 'utf8'));
		const op = doc.definitions.find(
			(d) => d.kind === 'OperationDefinition' && d.name?.value === 'siteConfig'
		) as OperationDefinitionNode;
		const root = op.selectionSet.selections[0] as FieldNode;
		const selected = root.selectionSet!.selections.map((s) => (s as FieldNode).name.value).sort();

		expect([...SITE_CONFIG_SCALAR_FIELDS, 'featureOverrides'].sort()).toEqual(selected);
		expect(Object.keys(toSiteConfigSeed(full, null)).sort()).toEqual(selected);
	});

	it('never ships the raw access lists', () => {
		expect(toSiteConfigSeed(full, {id: 'a', admin: true})).not.toHaveProperty('feature_overrides');
	});

	it('shows a viewer only their own entry on an access list', () => {
		expect(toSiteConfigSeed(full, {id: 'a'}).featureOverrides[0].users).toEqual([{id: 'a', username: 'ann'}]);
		expect(toSiteConfigSeed(full, null).featureOverrides[0].users).toEqual([]);
		expect(toSiteConfigSeed(full, {id: 'z', admin: true}).featureOverrides[0].users).toHaveLength(2);
	});

	it('serialises like GraphQL: ISO date, missing nullable columns as null', () => {
		const seed = toSiteConfigSeed(full, null);
		expect(seed.updated_at).toBe('2026-10-14T10:00:00.000Z');
		expect(seed.online_battle_enabled).toBeNull();
		expect(seed.method_steps_version).toBeNull();
	});
});
