import React, {useState} from 'react';
import {useDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {gql} from '@apollo/client';
import './TimerBackground.scss';
import {gqlMutate} from '../../../api';
import {getMe} from '../../../../actions/account';
import UploadCover from '../../../common/upload_cover/UploadCover';
import {useMe} from '../../../../util/hooks/useMe';
import {getStorageURL} from '../../../../util/storage';
import Button from '../../../common/button/Button';
import block from '../../../../styles/bem';
import {TimerBackground as TimerBackgroundSchema} from '../../../../@types/generated/graphql';
import {isPro} from '../../../../lib/pro';
import {Crown} from 'phosphor-react';

// Kept in step with the server's own cap in server/models/timer_background.ts.
const MAX_BACKGROUND_VIDEO_MB = 40;

const b = block('timer-background');

export default function TimerBackground() {
	const {t} = useTranslation();
	const dispatch = useDispatch();
	const me = useMe();
	const userIsPro = isPro(me);

	const [loading, setLoading] = useState(false);
	const [image, setImage] = useState<string>(getStorageURL(me?.timer_background?.storage_path) || '');
	// Null on rows written before video backgrounds existed; those are all images.
	const [isVideo, setIsVideo] = useState<boolean>(me?.timer_background?.media_type === 'video');

	async function uploadTimerBackground(variables) {
		const query = gql`
			mutation Mutate($file: Upload) {
				uploadTimerBackground(file: $file) {
					id
					storage_path
					media_type
				}
			}
		`;

		const res = await gqlMutate<{uploadTimerBackground: TimerBackgroundSchema}>(query, variables);
		const storagePath = res.data.uploadTimerBackground.storage_path;
		const url = getStorageURL(storagePath);

		setImage(url);
		setIsVideo(res.data.uploadTimerBackground.media_type === 'video');
		dispatch(getMe());

		return {
			storagePath,
		};
	}

	async function resetBackgroundImage() {
		if (loading) {
			return;
		}

		setLoading(true);

		const query = gql`
			mutation Mutate {
				deleteTimerBackground {
					id
				}
			}
		`;

		await gqlMutate(query);

		setImage('');
		setIsVideo(false);
		setLoading(false);
		dispatch(getMe());
	}

	if (!userIsPro) {
		return (
			<a href="/pro" className={b('locked')}>
				<div className={b('image')}>
					<div className={b('pro-overlay')}>
						<Crown weight="fill" className={b('pro-crown')} />
						<span className={b('pro-label')}>PRO</span>
					</div>
				</div>
			</a>
		);
	}

	return (
		<div className={b()}>
			<div className={b('image')}>
				<UploadCover upload={uploadTimerBackground} allowVideo maxFileSizeMb={MAX_BACKGROUND_VIDEO_MB} />
				{image ? (
					isVideo ? (
						// Muted and inline: a preview that asked for sound would be blocked from
						// autoplaying by every browser, and would leave an empty black box here.
						<video src={image} autoPlay loop muted playsInline />
					) : (
						<img src={image} alt="Timer background" />
					)
				) : null}
			</div>
			<p className={b('hint')}>{t('appearance.timer_background_hint', {size: MAX_BACKGROUND_VIDEO_MB})}</p>
			{image ? (
				<Button
					flat
					text={t('appearance.timer_background_reset')}
					danger
					onClick={resetBackgroundImage}
				/>
			) : null}
		</div>
	);
}
