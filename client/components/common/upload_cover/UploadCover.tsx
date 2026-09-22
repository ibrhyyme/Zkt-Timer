import React, {useState} from 'react';
import Dropzone from 'react-dropzone';
import './UploadCover.scss';
import {CloudArrowUp} from 'phosphor-react';
import {useTranslation} from 'react-i18next';
import block from '../../../styles/bem';
import {toastError} from '../../../util/toast';
import LoadingIcon from '../LoadingIcon';

const b = block('common-upload-cover');

// Must stay under graphqlUploadExpress maxFileSize in server/app.ts, and under nginx's
// client_max_body_size in production, which rejects a body before Node ever sees it.
const MAX_FILE_SIZE_MB = 30;

interface Props {
	allowGif?: boolean;
	/** Accept MP4 as well. Only the timer background does, and it has its own size cap. */
	allowVideo?: boolean;
	/** Overrides the image cap. Video files are allowed to be larger. */
	maxFileSizeMb?: number;
	upload: (variables: {file: any}) => Promise<{storagePath: string}>;
}

export default function UploadCover(props: Props) {
	const {allowGif, allowVideo, upload} = props;
	const maxFileSizeMb = props.maxFileSizeMb ?? MAX_FILE_SIZE_MB;
	const {t} = useTranslation();
	const [loading, setLoading] = useState(false);

	async function onDrop(files) {
		if (loading) {
			return;
		}

		if (!files.length) {
			toastError(t('upload.invalid_file'));
			return;
		}

		const file = files[0];

		// Pre-check size so oversized files fail fast with a clear message instead of
		// being rejected mid-stream by the server (which surfaces as a silent failure)
		if (file.size > maxFileSizeMb * 1024 * 1024) {
			toastError(t('upload.file_too_large', {size: maxFileSizeMb}));
			return;
		}

		setLoading(true);

		try {
			await upload({
				file,
			});
		} catch (e) {
			console.error('Upload failed:', e);
			toastError(t('upload.failed'));
		} finally {
			setLoading(false);
		}
	}

	let coverIcon = <CloudArrowUp weight="bold" />;

	if (loading) {
		coverIcon = <LoadingIcon />;
	}

	return (
		<div className={b({loading})}>
			<Dropzone
				maxFiles={1}
				accept={['.png', '.jpeg', '.jpg']
					.concat(allowGif ? ['.gif'] : [])
					.concat(allowVideo ? ['.mp4'] : [])}
				onDrop={onDrop}
			>
				{({getRootProps, getInputProps}) => (
					<div {...getRootProps()} className={b('body')}>
						<input {...getInputProps()} />
						<div>{coverIcon}</div>
					</div>
				)}
			</Dropzone>
		</div>
	);
}
