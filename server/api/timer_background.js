import {checkLoggedIn} from '../util/auth';
import GraphQLError from '../util/graphql_error';
import {
	clearTimerBackgroundSlot,
	setTimerBackgroundMobileSame,
	setTimerBackgroundSlot,
	storeTimerBackgroundFile,
	MAX_BACKGROUND_VIDEO_MB,
} from '../models/timer_background';
import {parseTimerBackgroundTarget} from '../../shared/timer_background';
import {ErrorCode} from '../constants/errors';
import {logger} from '../services/logger';
import {isProEnabled, isPro} from '../lib/pro';

// `target` is "desktop" or "mobile". Omitted means desktop, which is what clients built
// before the desktop / mobile split send.
export const gqlMutation = `
	deleteTimerBackground(target: String): TimerBackground!
	uploadTimerBackground(file: Upload, target: String): TimerBackground!
	setTimerBackgroundMobileSame(same: Boolean!): TimerBackground!
`;

function assertCanUseBackground(user) {
	checkLoggedIn(user);
	if (isProEnabled() && !isPro(user)) {
		throw new GraphQLError(ErrorCode.FORBIDDEN, 'Pro feature');
	}
}

export const mutateActions = {
	deleteTimerBackground: async (_, {target}, {user}) => {
		assertCanUseBackground(user);

		const background = await clearTimerBackgroundSlot(user, parseTimerBackgroundTarget(target));
		if (!background) {
			throw new GraphQLError(400, 'No background to delete');
		}
		return background;
	},
	setTimerBackgroundMobileSame: async (_, {same}, {user}) => {
		assertCanUseBackground(user);
		return setTimerBackgroundMobileSame(user, !!same);
	},
	uploadTimerBackground: async (_, {file, target}, {user}) => {
		assertCanUseBackground(user);

		if (!file) {
			throw new GraphQLError(400, 'File must be specified');
		}

		const {createReadStream, filename} = await file;

		let stored;
		try {
			stored = await storeTimerBackgroundFile(filename, createReadStream);
		} catch (e) {
			logger.warn('Failed to upload timer background', {
				error: e,
			});
			// A video over the cap is the user's problem to fix, not a server fault, and the
			// size has to reach them in their own language.
			if (e.message === 'FILE_TOO_LARGE') {
				throw new GraphQLError(ErrorCode.BAD_INPUT, `File is larger than ${MAX_BACKGROUND_VIDEO_MB} MB`, {
					i18nKey: 'upload.file_too_large',
					i18nValues: {size: MAX_BACKGROUND_VIDEO_MB},
				});
			}
			throw new GraphQLError(ErrorCode.SERVER, e.message);
		}

		return setTimerBackgroundSlot(user, parseTimerBackgroundTarget(target), stored);
	},
};
