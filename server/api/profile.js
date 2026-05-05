import GraphQLError from '../util/graphql_error';
import {checkLoggedIn} from '../util/auth';
import {getUserByUsername} from '../models/user_account';
import {getOrCreateUserProfile, getProfileById, updateUserProfile} from '../models/profile';
import {getUserTopAverages, getUserTopSolves} from '../models/top_solve';
import {deleteImage, uploadImageWithFile} from '../models/image';
import {createProfileView} from '../models/profile_view';
import {createReport, REPORT_TYPE_PROFILE, userHasPendingReportsForRecordId} from '../models/report';
import {ErrorCode} from '../constants/errors';
import {safeExternalUrl} from '../../shared/util/url';

// XSS koruma: profil URL alanlari (social link'ler vs.) sadece http/https olmali.
// javascript:, data: gibi protokoller silently null'a cevrilir.
const URL_FIELDS = ['youtube_link', 'twitch_link', 'twitter_link', 'reddit_link', 'website_link', 'instagram_link', 'tiktok_link'];

function sanitizeProfileInput(input) {
	if (!input || typeof input !== 'object') return input;
	const sanitized = {...input};
	for (const field of URL_FIELDS) {
		if (sanitized[field] !== undefined && sanitized[field] !== null) {
			const safe = safeExternalUrl(sanitized[field]);
			sanitized[field] = safe; // null donerse field bos kalir
		}
	}
	return sanitized;
}

export const gqlQuery = `
	profile(username: String): Profile!
`;

export const gqlMutation = `
	uploadProfileHeader(file: Upload): Image!
	uploadProfilePicture(file: Upload): Image!
	updateProfile(input: ProfileInput): Profile!
`;

export const queryActions = {
	profile: async (_, {username}, {user}) => {
		let profileUser = await getUserByUsername(username);

		if (!profileUser || !profileUser.length) {
			throw new GraphQLError(ErrorCode.NOT_FOUND, 'Could not find user with username');
		}

		profileUser = profileUser[0];

		const result = await Promise.all([
			getOrCreateUserProfile(profileUser),
			getUserTopSolves(profileUser),
			getUserTopAverages(profileUser),
		]);

		const profile = result[0];
		profile.top_solves = result[1];
		profile.top_averages = result[2];

		if (user?.id !== profileUser.id) {
			await createProfileView(profile, profileUser, user);
		}

		return profile;
	},
};

export const mutateActions = {
	updateProfile: async (_, {input}, {user}) => {
		checkLoggedIn(user);

		const safeInput = sanitizeProfileInput(input);
		const profile = await getOrCreateUserProfile(user);
		await updateUserProfile(profile, safeInput);

		return await getOrCreateUserProfile(user);
	},

	uploadProfilePicture: async (_, {file}, {user}) => {
		checkLoggedIn(user);

		if (!file) {
			throw new GraphQLError(400, 'File must be specified');
		}

		const {createReadStream, filename} = await file;

		const profile = await getOrCreateUserProfile(user);
		if (profile.pfp_image_id && profile.pfp_image) {
			await deleteImage(profile.pfp_image);
		}

		const image = await uploadImageWithFile(user, filename, createReadStream, {
			width: 400,
			height: 400,
		});

		await updateUserProfile(profile, {
			pfp_image_id: image.id,
		});

		return image;
	},
	uploadProfileHeader: async (_, {file}, {user}) => {
		checkLoggedIn(user);

		if (!file) {
			throw new GraphQLError(400, 'File must be specified');
		}

		const {createReadStream, filename} = await file;

		const profile = await getOrCreateUserProfile(user);
		if (profile.header_image_id && profile.header_image) {
			await deleteImage(profile.header_image);
		}

		const image = await uploadImageWithFile(user, filename, createReadStream, {
			width: 1700,
			height: 1700,
		});

		await updateUserProfile(profile, {
			header_image_id: image.id,
		});

		return image;
	},
};
