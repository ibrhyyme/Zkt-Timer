import Loki from 'lokijs';
import _ from 'lodash';
import LokiIndexDbAdaptor from 'lokijs/src/loki-indexed-adapter.js';

export interface LokiFetchOptions {
	sortBy?: string;
	sortInverse?: boolean;
	limit?: number;
	offset?: number;
}

export interface ExtendedLokiConfigOptions extends Partial<LokiConfigOptions> {
	disableAdapter?: boolean;
}

let db: Loki;
export function initLokiDb(op?: ExtendedLokiConfigOptions) {
	let options = undefined;
	let autoSave = true;

	let adapter = null;
	if (op?.disableAdapter) {
		adapter = null;
		autoSave = false;
	} else if (typeof indexedDB === 'undefined') {
		autoSave = false;
	} else {
		adapter = new LokiIndexDbAdaptor();
	}

	if (typeof localStorage !== 'undefined') {
		options = {
			adapter,
			autosave: autoSave,
			autosaveInterval: 4000,
			...op,
		};

		// Remove undefined values only (null must be preserved for adapter: null)
		options = _.omitBy(options, _.isUndefined);
	}

	// Ensure options is an object if it was undefined to avoid passing undefined to Loki constructor if it expects optional
	db = new Loki('zkttimer.db', options || {});
}

export function getLokiDb() {
	return db;
}

export function stripLokiJsMetadata(record) {
	const cleanRec = { ...record };
	delete cleanRec['meta'];
	delete cleanRec['$loki'];
	return cleanRec;
}
