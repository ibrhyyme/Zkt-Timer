import {checkLoggedIn} from '../util/auth';
import GraphQLError from '../util/graphql_error';
import {
	deleteTimerBackground,
	getTimerBackground,
	uploadTimerBackgroundWithFile,
	MAX_BACKGROUND_VIDEO_MB,
} from '../models/timer_background';
import {ErrorCode} from '../constants/errors';
import {logger} from '../services/logger';
import {isProEnabled, isPro} from '../lib/pro';

export const gqlMutation = `
	deleteTimerBackground: TimerBackground!
	uploadTimerBackground(file: Upload): TimerBackground!
	setTimerBackgroundHex(hex: String): TimerBackground!
`;

export const mutateActions = {
	deleteTimerBackground: async (_, params, {user}) => {
		checkLoggedIn(user);
		if (isProEnabled() && !isPro(user)) {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'Pro feature');
		}

		const background = await getTimerBackground(user);
		if (!background) {
			throw new GraphQLError(400, 'No background to delete');
		}

		await deleteTimerBackground(background);
		return background;
	},
	uploadTimerBackground: async (_, {file}, {user}) => {
		checkLoggedIn(user);
		if (isProEnabled() && !isPro(user)) {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'Pro feature');
		}

		if (!file) {
			throw new GraphQLError(400, 'File must be specified');
		}

		const {createReadStream, filename} = await file;

		const background = await getTimerBackground(user);

		if (background) {
			await deleteTimerBackground(background);
		}

		try {
			await uploadTimerBackgroundWithFile(user, filename, createReadStream);
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

		return await getTimerBackground(user);
	},
};
