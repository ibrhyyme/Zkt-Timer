// server/services/search.ts
import { Client, ClientOptions } from '@elastic/elasticsearch';

let client: Client;

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
	} catch (e) {
		console.error('Could not initiate Elasticsearch client', e);
	}
}

export function getSearchClient() {
	return client;
}