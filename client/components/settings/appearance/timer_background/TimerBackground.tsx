import React, {useEffect, useState} from 'react';
import {useDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {gql} from '@apollo/client';
import './TimerBackground.scss';
import {gqlMutate} from '../../../api';
import {getMe} from '../../../../actions/account';
import UploadCover from '../../../common/upload_cover/UploadCover';
import TimerVideoBackground from '../../../timer/timer_background/TimerVideoBackground';
import {useMe} from '../../../../util/hooks/useMe';
import {getStorageURL} from '../../../../util/storage';
import Button from '../../../common/button/Button';
import block from '../../../../styles/bem';
import {TimerBackground as TimerBackgroundSchema} from '../../../../@types/generated/graphql';
import {isPro} from '../../../../lib/pro';
import {Crown} from 'phosphor-react';
import {
	TimerBackgroundTarget,
	getTimerBackgroundSlot,
	isMobileSameAsDesktop,
} from '../../../../../shared/timer_background';

// Kept in step with the server's own cap in server/models/timer_background.ts.
const MAX_BACKGROUND_VIDEO_MB = 40;

const b = block('timer-background');

interface Props {
	/** Which slot this picker edits. The desktop slot is also what phones show by default. */
	target: TimerBackgroundTarget;
}

export default function TimerBackground({target}: Props) {
	const {t} = useTranslation();
	const dispatch = useDispatch();
	const me = useMe();
	const userIsPro = isPro(me);

	const slot = getTimerBackgroundSlot(me?.timer_background, target);
	const slotPath = slot?.storage_path || '';
	const slotIsVideo = !!slot?.is_video;

	const [loading, setLoading] = useState(false);
	const [image, setImage] = useState<string>(getStorageURL(slotPath) || '');
	const [isVideo, setIsVideo] = useState<boolean>(slotIsVideo);

	// Follow the account once getMe() lands (or another device changed the slot).
	useEffect(() => {
		setImage(getStorageURL(slotPath) || '');
		setIsVideo(slotIsVideo);
	}, [slotPath, slotIsVideo]);

	async function uploadTimerBackground(variables) {
		const query = gql`
			mutation Mutate($file: Upload, $target: String) {
				uploadTimerBackground(file: $file, target: $target) {
					id
					storage_path
					media_type
					mobile_storage_path
					mobile_media_type
					mobile_same_as_desktop
				}
			}
		`;

		const res = await gqlMutate<{uploadTimerBackground: TimerBackgroundSchema}>(query, {...variables, target});
		const uploaded = getTimerBackgroundSlot(res.data.uploadTimerBackground, target);
		const storagePath = uploaded?.storage_path;

		setImage(getStorageURL(storagePath) || '');
		setIsVideo(!!uploaded?.is_video);
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
			mutation Mutate($target: String) {
				deleteTimerBackground(target: $target) {
					id
				}
			}
		`;

		try {
			await gqlMutate(query, {target});
			setImage('');
			setIsVideo(false);
		} finally {
			setLoading(false);
			dispatch(getMe());
		}
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
						// The timer's own player, not a bare <video autoPlay muted>: React 17 leaves
						// `muted` out of server markup, so an SSR'd autoplay video counts as unmuted
						// and the browser refuses to start it. Same player also means the preview
						// honours reduced motion exactly like the timer does.
						<TimerVideoBackground src={image} paused={false} />
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

/**
 * "Use the same on mobile". On by default, which is how backgrounds from before the
 * desktop / mobile split keep showing on phones. Optimistic: the switch moves at once and
 * snaps back if the server refuses.
 */
export function useTimerBackgroundMobileSame(): [boolean, () => Promise<void>] {
	const dispatch = useDispatch();
	const me = useMe();
	const serverValue = isMobileSameAsDesktop(me?.timer_background);
	const [pending, setPending] = useState<boolean | null>(null);

	useEffect(() => {
		setPending(null);
	}, [serverValue]);

	async function toggle() {
		const next = !(pending ?? serverValue);
		setPending(next);

		const query = gql`
			mutation Mutate($same: Boolean!) {
				setTimerBackgroundMobileSame(same: $same) {
					id
				}
			}
		`;

		try {
			await gqlMutate(query, {same: next});
		} catch (e) {
			setPending(null);
		}
		dispatch(getMe());
	}

	return [pending ?? serverValue, toggle];
}
