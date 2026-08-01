#!/usr/bin/env node
/**
 * One-off repair for images uploaded before the EXIF fix in server/util/image.ts.
 *
 * Background: Jimp rotated the pixels on read, but jpeg-js wrote the original EXIF
 * block back into the output. Viewers then applied the orientation a second time and
 * the photo showed up on its side. The stored pixels are already correct, so the repair
 * is simply to drop the EXIF block - no re-encoding, no quality loss.
 *
 * Only folders whose uploads go through getImageBufferFromFileStream are touched
 * (images/, timer_backgrounds/). Support ticket attachments are stored raw, their
 * orientation tag is still load-bearing, and they are deliberately left alone.
 *
 * Usage (run on the host - public/uploads is a bind-mounted volume, no container needed):
 *   node scripts/fix-sideways-images.js                 # dry run, reports only
 *   node scripts/fix-sideways-images.js --apply         # writes, after backing up
 *   node scripts/fix-sideways-images.js --apply --dir /srv/zkt/public/uploads
 */

const fs = require('fs');
const path = require('path');

const TARGET_SUBDIRS = ['images', 'timer_backgrounds'];
const JPEG_EXTENSIONS = new Set(['.jpg', '.jpeg']);

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const dirFlagIndex = args.indexOf('--dir');
const uploadsRoot =
	dirFlagIndex !== -1 && args[dirFlagIndex + 1]
		? args[dirFlagIndex + 1]
		: path.join(process.cwd(), 'public', 'uploads');

/** Reads the EXIF Orientation value, or null when the file carries no orientation tag. */
function readOrientation(exifSegment) {
	// Segment layout: FFE1 <len:2> "Exif\0\0" <TIFF header ...>
	const tiff = exifSegment.slice(10);
	if (tiff.length < 8) return null;

	const little = tiff.toString('ascii', 0, 2) === 'II';
	const u16 = (off) => (little ? tiff.readUInt16LE(off) : tiff.readUInt16BE(off));
	const u32 = (off) => (little ? tiff.readUInt32LE(off) : tiff.readUInt32BE(off));

	const ifdOffset = u32(4);
	if (ifdOffset + 2 > tiff.length) return null;

	const entryCount = u16(ifdOffset);
	for (let i = 0; i < entryCount; i++) {
		const entry = ifdOffset + 2 + i * 12;
		if (entry + 12 > tiff.length) break;
		if (u16(entry) === 0x0112) return u16(entry + 8);
	}
	return null;
}

/**
 * Removes every APP1/Exif segment from a JPEG. Returns null when the file is not a
 * JPEG or carries no EXIF at all.
 */
function stripExif(buffer) {
	if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

	const kept = [buffer.slice(0, 2)];
	let offset = 2;
	let removed = 0;
	let orientation = null;

	while (offset < buffer.length - 1) {
		if (buffer[offset] !== 0xff) break;
		const marker = buffer[offset + 1];

		// Standalone markers carry no payload.
		if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
			kept.push(buffer.slice(offset, offset + 2));
			offset += 2;
			continue;
		}

		// Start of scan: everything after this is compressed image data.
		if (marker === 0xda) {
			kept.push(buffer.slice(offset));
			offset = buffer.length;
			break;
		}

		if (offset + 4 > buffer.length) break;
		const segmentLength = buffer.readUInt16BE(offset + 2);
		const segment = buffer.slice(offset, offset + 2 + segmentLength);

		const isExif = marker === 0xe1 && segment.slice(4, 10).toString('binary') === 'Exif\0\0';
		if (isExif) {
			removed++;
			if (orientation === null) orientation = readOrientation(segment);
		} else {
			kept.push(segment);
		}

		offset += 2 + segmentLength;
	}

	if (!removed) return null;
	return {buffer: Buffer.concat(kept), orientation};
}

function collectFiles(dir) {
	if (!fs.existsSync(dir)) return [];
	return fs
		.readdirSync(dir, {withFileTypes: true})
		.filter((entry) => entry.isFile() && JPEG_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
		.map((entry) => path.join(dir, entry.name));
}

function main() {
	if (!fs.existsSync(uploadsRoot)) {
		console.error(`uploads directory not found: ${uploadsRoot}`);
		console.error('pass the right path with --dir');
		process.exit(1);
	}

	const backupDir = path.join(
		path.dirname(uploadsRoot),
		`exif-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}`
	);

	console.log(`uploads root : ${uploadsRoot}`);
	console.log(`mode         : ${apply ? 'APPLY (files will be rewritten)' : 'dry run'}`);
	if (apply) console.log(`backup dir   : ${backupDir}`);
	console.log('');

	let scanned = 0;
	let withExif = 0;
	let sideways = 0;
	let rewritten = 0;
	let bytesSaved = 0;

	for (const subdir of TARGET_SUBDIRS) {
		const files = collectFiles(path.join(uploadsRoot, subdir));
		if (!files.length) continue;
		console.log(`${subdir}/ : ${files.length} jpeg files`);

		for (const file of files) {
			scanned++;
			let original;
			try {
				original = fs.readFileSync(file);
			} catch (e) {
				console.log(`  ! unreadable ${path.basename(file)}: ${e.message}`);
				continue;
			}

			const result = stripExif(original);
			if (!result) continue;

			withExif++;
			const wasSideways = result.orientation != null && result.orientation > 1;
			if (wasSideways) sideways++;

			if (!apply) {
				console.log(
					`  would fix ${path.basename(file)} (orientation=${result.orientation ?? 'none'}${
						wasSideways ? ', SIDEWAYS' : ', upright already'
					})`
				);
				continue;
			}

			try {
				const relative = path.relative(uploadsRoot, file);
				const backupPath = path.join(backupDir, relative);
				fs.mkdirSync(path.dirname(backupPath), {recursive: true});
				fs.writeFileSync(backupPath, original);
				fs.writeFileSync(file, result.buffer);
				rewritten++;
				bytesSaved += original.length - result.buffer.length;
			} catch (e) {
				console.log(`  ! failed ${path.basename(file)}: ${e.message}`);
			}
		}
	}

	console.log('');
	console.log(`scanned            : ${scanned}`);
	console.log(`carrying EXIF      : ${withExif}`);
	console.log(`actually sideways  : ${sideways}`);
	if (apply) {
		console.log(`rewritten          : ${rewritten}`);
		console.log(`bytes reclaimed    : ${bytesSaved}`);
		console.log('');
		console.log(`Originals are in ${backupDir}`);
		console.log('To roll back: copy that folder back over public/uploads.');
	} else {
		console.log('');
		console.log('Nothing was written. Re-run with --apply to fix.');
	}
}

main();
