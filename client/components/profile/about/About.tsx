import React from 'react';
import { useTranslation } from 'react-i18next';
import './About.scss';
import { Profile } from '../../../@types/generated/graphql';
import block from '../../../styles/bem';

const b = block('profile-about');

interface Props {
	profile: Profile;
}

/**
 * A bio worth rendering. Some rows carry the literal strings "undefined"/"null"
 * (an old import wrote the result of String(undefined) into the column), and
 * those printed straight onto the profile as the word `undefined`.
 */
export function meaningfulBio(bio?: string | null): string | null {
	const trimmed = (bio || '').trim();
	if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null;
	return trimmed;
}

export default function About(props: Props) {
	const { t } = useTranslation();
	const { profile } = props;
	const bio = meaningfulBio(profile.bio);

	const chips: { label: string; value: string }[] = [];
	if (profile.main_three_cube) {
		chips.push({ label: t('profile.main_3x3_cube'), value: profile.main_three_cube });
	}
	if (profile.favorite_event) {
		chips.push({ label: t('profile.favorite_event'), value: profile.favorite_event });
	}

	return (
		<div className={b()}>
			{bio && <p className={b('bio')}>{bio}</p>}
			{!bio && <p className={b('bio', { empty: true })}>{t('profile.no_bio')}</p>}
			{chips.length > 0 && (
				<div className={b('chips')}>
					{chips.map((chip) => (
						<span key={chip.label} className={b('chip')}>
							{chip.value}
						</span>
					))}
				</div>
			)}
		</div>
	);
}
