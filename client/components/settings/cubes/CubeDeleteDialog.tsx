import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './CubeForm.scss';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import { LocalCube } from '../../../lib/cubes/active_cube';
import { deleteCubeOnline, setCubeArchivedOnline } from '../../../lib/cubes/sync';
import { formatInteger } from '../../../util/locale_format';
import { cubeErrorMessage } from './cube_errors';

const b = block('cube-form');

interface Props {
	cube: LocalCube;
	onDeleted?: () => void;
	// Injected by Modal.
	onClose?: () => void;
	onComplete?: (data?: any) => void;
}

/**
 * Delete confirmation (5.2): says how many solves stay unlinked, and offers archiving in the same
 * dialog, which keeps the link and only hides the cube.
 */
export default function CubeDeleteDialog(props: Props) {
	const { cube, onDeleted, onClose, onComplete } = props;
	const { t, i18n } = useTranslation();
	const [busy, setBusy] = useState<'delete' | 'archive' | null>(null);
	const [error, setError] = useState('');

	async function run(kind: 'delete' | 'archive') {
		if (busy) return;
		setBusy(kind);
		setError('');
		try {
			if (kind === 'delete') {
				await deleteCubeOnline(cube.id);
			} else {
				await setCubeArchivedOnline(cube.id, true);
			}
			setBusy(null);
			if (onComplete) onComplete();
			if (kind === 'delete' && onDeleted) onDeleted();
		} catch (err) {
			setBusy(null);
			setError(cubeErrorMessage(err, t));
		}
	}

	const count = cube.solve_count || 0;

	return (
		<div className={b({ dialog: true })}>
			<div className={b('grabber')} aria-hidden="true" />
			<h2 className={b('title')}>{t('cubes.delete_title', { name: cube.name })}</h2>
			<p className={b('text')}>
				{count > 0
					? t('cubes.delete_text', { count, n: formatInteger(count, i18n.language) })
					: t('cubes.delete_text_empty')}
			</p>

			{error ? (
				<p className={b('error')} role="alert">
					{error}
				</p>
			) : null}

			<div className={b('actions', { stacked: true })}>
				<Button
					type="button"
					text={t('cubes.action_delete')}
					danger
					loading={busy === 'delete'}
					disabled={!!busy}
					onClick={() => void run('delete')}
				/>
				{!cube.archived_at ? (
					<Button
						type="button"
						text={t('cubes.action_archive')}
						gray
						loading={busy === 'archive'}
						disabled={!!busy}
						onClick={() => void run('archive')}
					/>
				) : null}
				<Button type="button" text={t('cubes.form_cancel')} transparent disabled={!!busy} onClick={() => onClose && onClose()} />
			</div>
		</div>
	);
}
