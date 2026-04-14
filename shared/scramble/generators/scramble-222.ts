/**
 * 2x2x2 scramble generator — wraps the existing port for the registry system.
 * The actual implementation lives in client/util/cubes/scramble_222.ts (full cstimer port).
 */

import { registerGenerator } from '../registry';
import { generate222Scramble } from '../../../client/util/cubes/scramble_222';

const ALL_222_TYPES = [
	'222so', '222o', '222nb', '2223',
	'222eg', '222eg0', '222eg1', '222eg2',
	'222tcp', '222tcn', '222tc', '222lsall',
];

registerGenerator(ALL_222_TYPES, (typeId) => generate222Scramble(typeId));
