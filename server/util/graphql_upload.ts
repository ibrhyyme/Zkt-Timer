import {Readable} from 'stream';
import {GraphQLScalarType} from 'graphql';
import GraphQLError from './graphql_error';
import {ErrorCode} from '../constants/errors';

// graphql-yoga parses multipart requests itself and puts a WHATWG File where the
// variable was. Every consumer downstream (image decoding, support attachments,
// timer backgrounds) was written against graphql-upload's shape, so the scalar
// hands them that shape instead of each call site converting.
export interface FileUpload {
	filename: string;
	mimetype: string;
	createReadStream: () => Readable;
}

function isFile(value: unknown): value is File {
	return (
		value != null &&
		typeof value === 'object' &&
		typeof (value as File).name === 'string' &&
		typeof (value as File).arrayBuffer === 'function'
	);
}

function toFileUpload(file: File): FileUpload {
	return {
		filename: file.name,
		mimetype: file.type,
		// The multipart parser has already buffered the file, so this only wraps it.
		createReadStream: () =>
			Readable.from(
				(async function* () {
					yield Buffer.from(await file.arrayBuffer());
				})()
			),
	};
}

export const GraphQLUpload = new GraphQLScalarType({
	name: 'Upload',
	description: 'The `Upload` scalar type represents a file upload.',
	parseValue(value) {
		if (!isFile(value)) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Upload value invalid.');
		}
		return toFileUpload(value);
	},
	parseLiteral() {
		throw new GraphQLError(ErrorCode.BAD_INPUT, 'Upload literal unsupported.');
	},
	serialize() {
		throw new GraphQLError(ErrorCode.BAD_INPUT, 'Upload serialization unsupported.');
	},
});
