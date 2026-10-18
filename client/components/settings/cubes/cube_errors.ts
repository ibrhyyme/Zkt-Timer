import { getGqlErrorMessage } from '../../../util/gql-error';
import { isCubeConnectivityError } from '../../../lib/cubes/sync';

type Translate = (key: string, options?: any) => any;

/** What a failed cube request says: the offline sentence, the server's cube_errors.* text, or a generic line. */
export function cubeErrorMessage(err: unknown, t: Translate): string {
	if (isCubeConnectivityError(err)) return String(t('cubes.needs_internet'));
	return getGqlErrorMessage(err, t, 'cubes.error_generic');
}
