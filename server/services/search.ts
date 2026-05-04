// server/services/search.ts
import { Client, ClientOptions } from '@elastic/elasticsearch';

let client: Client;

export const ARCHIVED_COMP_INDEX = 'zkt_archived_competitions';

export function initSearch() {
	try {
		const clientOptions: ClientOptions = {};

		// Hem Cloud hem Docker desteği
		if (process.env.ELASTICSEARCH_CLOUD_ID) {
			clientOptions.cloud = {
				id: process.env.ELASTICSEARCH_CLOUD_ID,
			};
			clientOptions.auth = {
				username: 'elastic',
				password: process.env.ELASTICSEARCH_ELASTIC_PASSWORD,
			};
		} else {
			// Docker için bu satır şart
			clientOptions.node = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
		}

		client = new Client(clientOptions);

		// Index bootstrap — yoksa olustur (fire-and-forget, server start'i blokmuyor)
		bootstrapArchivedCompIndex().catch((e) => {
			console.warn('[ES] archived comp index bootstrap failed', e?.message);
		});
	} catch (e) {
		console.error('Could not initiate Elasticsearch client', e);
	}
}

export function getSearchClient() {
	return client;
}

async function bootstrapArchivedCompIndex() {
	if (!client) return;
	try {
		const exists = await client.indices.exists({index: ARCHIVED_COMP_INDEX});
		if (exists) return;

		await client.indices.create({
			index: ARCHIVED_COMP_INDEX,
			body: {
				mappings: {
					properties: {
						id: {type: 'keyword'},
						name: {type: 'text', analyzer: 'standard'},
						start_date: {type: 'date'},
						end_date: {type: 'date'},
						country_iso2: {type: 'keyword'},
						city: {type: 'keyword'},
						event_ids: {type: 'keyword'},
						competitors: {
							type: 'nested',
							properties: {
								wca_id: {type: 'keyword'},
								name: {type: 'text', fields: {keyword: {type: 'keyword'}}},
							},
						},
					},
				},
			} as any,
		});
		console.log(`[ES] Created index: ${ARCHIVED_COMP_INDEX}`);
	} catch (e: any) {
		// Index zaten varsa "resource_already_exists_exception" gelebilir — sessiz ignore
		if (e?.meta?.body?.error?.type !== 'resource_already_exists_exception') {
			throw e;
		}
	}
}