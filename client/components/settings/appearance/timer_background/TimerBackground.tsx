import React, {useState} from 'react';
import {useDispatch} from 'react-redux';
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

const b = block('timer-background');

export default function TimerBackground() {
	const dispatch = useDispatch();
	const me = useMe();
	const userIsPro = isPro(me);

	const [loading, setLoading] = useState(false);
	const [image, setImage] = useState<string>(getStorageURL(me?.timer_background?.storage_path) || '');

	async function uploadTimerBackground(variables) {
		const query = gql`
			mutation Mutate($file: Upload) {
				uploadTimerBackground(file: $file) {
					id
					storage_path
				}
			}
		`;

		const res = await gqlMutate<{uploadTimerBackground: TimerBackgroundSchema}>(query, variables);
		const storagePath = res.data.uploadTimerBackground.storage_path;
		const url = getStorageURL(storagePath);

		setImage(url);
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
		setLoading(false);
		dispatch(getMe());
	}

	if (!userIsPro) {
		return (
			<a href="/account/pro" className={b('locked')}>
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
				<UploadCover upload={uploadTimerBackground} />
				{image ? <img src={image} alt="Timer background" /> : null}
			</div>
			{image ? <Button flat text="Reset background" danger onClick={resetBackgroundImage} /> : null}
		</div>
	);
}
