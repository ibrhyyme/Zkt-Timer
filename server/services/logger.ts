import winston, {Logger} from 'winston';
import {ElasticsearchTransport} from 'winston-elasticsearch';
import {getSearchClient} from './search';

let logger: Logger;

export function initLogger() {
	const transports = [];
	const isDev = process.env.ENV === 'development';

	const addFormats = [];
	if (isDev) {
		transports.push(new winston.transports.Console());
		addFormats.push(
			winston.format.timestamp({
				format: 'YYYY-MM-DD HH:MM:SS',
			})
		);
		addFormats.push(
			winston.format.colorize({
				level: true,
				message: true,
			}),
			winston.format.printf((info) => {
				const meta = info.metadata;
				const metaStr = meta && Object.keys(meta).length ? ' | ' + `${JSON.stringify(meta)}` : '';
				return `${info.level} ${info.timestamp}: ${info.message}${metaStr}`;
			})
		);
	} else {
		const esTransport = new ElasticsearchTransport({
			client: getSearchClient(),
			level: process.env.LOG_LEVEL,
		});
		// winston-elasticsearch bulk_writer doesn't suppress rejections — prevent unhandled rejection buildup
		esTransport.on('error', (err) => {
			console.error('[Logger] ES transport error:', (err as any)?.message ?? err);
		});
		transports.push(esTransport);

		addFormats.push(winston.format.json());
	}

	// In Elasticsearch, the 'error' field must always be indexed as an object.
	// Some places pass Error objects, others pass strings — normalize to prevent type mismatches.
	const normalizeErrorField = winston.format((info) => {
		const meta = (info as any).metadata;
		if (meta && 'error' in meta) {
			const err = meta.error;
			if (err instanceof Error) {
				meta.error = {message: err.message, stack: err.stack};
			} else if (typeof err === 'string') {
				meta.error = {message: err};
			} else if (err !== null && typeof err === 'object') {
				// already an object — compatible with mapping, pass through
			} else {
				// number/boolean/null/undefined — wrap primitive in object so ES mapping doesn't break
				meta.error = {value: String(err)};
			}
		}
		return info;
	});

	const defaultFormats = [
		winston.format.errors({stack: true}),
		winston.format.splat(),
		winston.format.metadata({fillExcept: ['message', 'level', 'timestamp', 'label']}),
		normalizeErrorField(),
		...addFormats,
	];

	logger = winston.createLogger({
		level: process.env.LOG_LEVEL,
		defaultMeta: {
			env: process.env.ENV,
		},
		exitOnError: false,
		format: winston.format.combine(...defaultFormats),
		transports,
	});
}

export {logger};
