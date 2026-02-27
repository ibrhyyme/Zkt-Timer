import React, { useState } from 'react';
import './AvatarImage.scss';
import { getStorageURL, resourceUri } from '../../../../util/storage';
import block from '../../../../styles/bem';
import { PublicUserAccount, UserAccount, UserAccountForAdmin } from '../../../../../server/schemas/UserAccount.schema';
import { Profile } from '../../../../../server/schemas/Profile.schema';
import {
	PublicUserAccount as GqlPublicUserAccount,
	UserAccount as GqlUserAccount,
	UserAccountForAdmin as GqlUserAccountForAdmin,
	Profile as GqlProfile,
} from '../../../../@types/generated/graphql';
import { isPro, isProEnabled } from '../../../../util/pro';

const b = block('avatar-image');

const COLORS = [
	'#05445E',
	'#0C2D48',
	'#145DA0',
	'#167D7F',
	'#29A0B1',

	'#2F5061',
	'#E57F84',
	'#4297A0',
	'#333652',
	'#41729F',

	'#887BB0',
	'#603F8B',
	'#C85250',
	'#2F5233',
	'#549BAD',

	'#385E72',
	'#313E61',
	'#774A62',
	'#414754',
	'#82807F',

	'#A8BBB0',
	'#6E6D6E',
	'#D18D96',
	'#34586E',
	'#A47786',

	'#107869',

	'#5D59AF',
	'#A072BE',
	'#52688F',
	'#7391C8',
	'#607D86',

	'#715C8C',
	'#333F63',
	'#543855',
	'#C44B4F',
	'#4C5355',
];

// Combined types for props
type AvatarImageUser =
	| UserAccountForAdmin
	| PublicUserAccount
	| UserAccount
	| GqlUserAccountForAdmin
	| GqlPublicUserAccount
	| GqlUserAccount;

type AvatarImageProfile = Profile | GqlProfile;

interface Props {
	user?: AvatarImageUser;
	profile?: AvatarImageProfile;
	image?: string;
	small?: boolean;
	tiny?: boolean;
	large?: boolean;
}

export default function AvatarImage(props: Props) {
	const { large, tiny, small, image } = props;
	const [imageError, setImageError] = useState(false);

	const user = props.user || props.profile?.user;
	const profile = props.profile || props.user?.profile;

	const showProRing = isProEnabled() && isPro(user);

	// Check if we have a profile image and it hasn't failed to load
	const hasProfileImage = ((profile && profile.pfp_image) || image) && !imageError;

	let avatar;
	if (hasProfileImage) {
		const avatarSrc = image || getStorageURL(profile?.pfp_image?.storage_path);

		avatar = (
			<div className={b({pro: showProRing})}>
				<div className={b('body', { large, small, tiny })}>
					<img
						src={avatarSrc}
						alt={`Profile picture of ${user?.username || 'user'}`}
						onError={() => {
							console.warn('Avatar load failed:', avatarSrc);
							setImageError(true);
						}}
						onLoad={() => setImageError(false)}
					/>
				</div>
			</div>
		);
	} else {
		// Fallback: Show user initials with colored background
		const lastLetter = user?.id?.[user.id.length - 1] || 'a';
		const lastIndex = 'abcdefghijklmnopqrstuvwxyz0123456789'.indexOf(lastLetter);
		const backgroundColor = COLORS[lastIndex % COLORS.length];

		// Get user initials
		const getInitials = (name?: string) => {
			if (!name) return '?';
			const parts = name.trim().split(/\s+/);
			const [a, b] = [parts[0]?.[0], parts[1]?.[0]];
			return (a || '').toUpperCase() + (b || '').toUpperCase();
		};

		const initials = getInitials(user?.username || (user as any)?.first_name);

		avatar = (
			<div className={b({pro: showProRing})}>
				<div
					className={b('body', { default: true, large, small, tiny })}
					style={{ backgroundColor }}
				>
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							width: '100%',
							height: '100%',
							color: 'white',
							fontWeight: 'bold',
							fontSize: large ? '24px' : small || tiny ? '12px' : '16px'
						}}
					>
						{initials}
					</div>
				</div>
			</div>
		);
	}

	return avatar;
}
