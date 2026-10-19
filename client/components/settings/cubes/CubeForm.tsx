import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuid } from 'uuid';
import './CubeForm.scss';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import { useCubes } from '../../../lib/cubes/store';
import { createCubeOnline, updateCubeOnline } from '../../../lib/cubes/sync';
import { cubesForPuzzle, LocalCube } from '../../../lib/cubes/active_cube';
import { getCustomCubeTypes } from '../../../util/cubes/util';
import {
	BRAND_SUGGESTIONS,
	CUBE_BRAND_MAX,
	CUBE_NAME_MAX,
	formPuzzleOptions,
	puzzleLabel,
} from './cube_labels';
import { cubeErrorMessage } from './cube_errors';
import { useKeyboardInset } from '../../../util/hooks/useKeyboardInset';
import { useGeneral } from '../../../util/hooks/useGeneral';

const b = block('cube-form');

export interface CubeFormProps {
	/** Editing this cube. Absent: a new cube. */
	cube?: LocalCube | null;
	/** Puzzle preselected for a new cube (timer link, a section's add button). */
	puzzle?: string | null;
	/** Called with the saved cube after the modal closes. */
	onSaved?: (cube: LocalCube) => void;
	// Injected by Modal.
	onClose?: () => void;
	onComplete?: (data?: any) => void;
}

/**
 * Add or edit a cube (design 5.2). A bottom sheet on phones, a modal on desktop; the caller
 * picks the modal position (cube_actions.ts). Needs the network: the cube must exist on the
 * server before any solve can point at it (4.4).
 */
export default function CubeForm(props: CubeFormProps) {
	const { cube, onSaved, onClose, onComplete } = props;
	const { t } = useTranslation();
	const state = useCubes();
	const editing = !!cube;
	// The sheet sits on the bottom edge; an overlaying keyboard would cover the fields.
	const keyboardInset = useKeyboardInset();
	// A phone gets the tall buttons: the default height read as too small to tap in the sheet.
	const mobileMode = useGeneral('mobile_mode');

	const customTypes = useMemo(() => getCustomCubeTypes(), []);
	const puzzleOptions = useMemo(() => formPuzzleOptions(customTypes), [customTypes]);

	const initialPuzzle = cube?.puzzle || (props.puzzle && puzzleOptions.some((o) => o.id === props.puzzle) ? props.puzzle : '333');

	// One id per form: a second tap on Save after a lost answer creates the same cube, not two.
	const newId = useRef(uuid());
	const [puzzle, setPuzzle] = useState(initialPuzzle);
	const [name, setName] = useState(cube?.name || '');
	const [brand, setBrand] = useState(cube?.brand || '');
	const [isSmart, setIsSmart] = useState(!!cube?.is_smart);
	const [makeMain, setMakeMain] = useState(false);
	const [error, setError] = useState('');
	const [saving, setSaving] = useState(false);

	// The first cube of a puzzle becomes its main by itself (server rule), so the box only
	// shows when the puzzle already has cubes.
	const puzzleHasCubes = cubesForPuzzle(puzzle, state).length > 0;

	function close() {
		if (onClose) onClose();
	}

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (saving) return;

		const trimmedName = name.trim();
		const trimmedBrand = brand.trim();
		if (!trimmedName) {
			setError(t('cubes.form_name_required'));
			return;
		}

		setSaving(true);
		setError('');
		try {
			const saved = editing
				? await updateCubeOnline(cube.id, { name: trimmedName, brand: trimmedBrand || null, is_smart: isSmart })
				: await createCubeOnline({
					id: newId.current,
					puzzle,
					name: trimmedName,
					brand: trimmedBrand || null,
					is_smart: isSmart,
					make_main: puzzleHasCubes && makeMain,
					...(puzzleHasCubes && makeMain ? { set_at: new Date().toISOString() } : {}),
				});
			setSaving(false);
			if (onComplete) onComplete(saved);
			if (saved && onSaved) onSaved(saved);
		} catch (err) {
			setSaving(false);
			setError(cubeErrorMessage(err, t));
		}
	}

	return (
		<form
			className={b()}
			onSubmit={submit}
			noValidate
			style={keyboardInset ? ({ '--cube-form-keyboard': `${keyboardInset}px` } as React.CSSProperties) : undefined}
		>
			<div className={b('grabber')} aria-hidden="true" />
			<h2 className={b('title')}>{editing ? t('cubes.form_title_edit') : t('cubes.form_title_add')}</h2>

			<label className={b('field')}>
				<span className={b('label')}>{t('cubes.form_puzzle')}</span>
				{editing ? (
					<>
						<span className={b('locked')}>{puzzleLabel(puzzle, customTypes)}</span>
						<span className={b('note')}>{t('cubes.form_puzzle_locked')}</span>
					</>
				) : (
					<select className={b('input')} value={puzzle} onChange={(e) => setPuzzle(e.target.value)}>
						{puzzleOptions.map((option) => (
							<option key={option.id} value={option.id}>
								{option.label}
							</option>
						))}
					</select>
				)}
			</label>

			<label className={b('field')}>
				<span className={b('label')}>{t('cubes.form_name')}</span>
				<input
					className={b('input')}
					type="text"
					value={name}
					maxLength={CUBE_NAME_MAX}
					placeholder={t('cubes.form_name_placeholder')}
					autoComplete="off"
					onChange={(e) => {
						setName(e.target.value);
						setError('');
					}}
				/>
			</label>

			<label className={b('field')}>
				<span className={b('label')}>{t('cubes.form_brand')}</span>
				<input
					className={b('input')}
					type="text"
					value={brand}
					maxLength={CUBE_BRAND_MAX}
					placeholder={t('cubes.form_brand_placeholder')}
					autoComplete="off"
					list="zt-cube-form-brands"
					onChange={(e) => setBrand(e.target.value)}
				/>
				<datalist id="zt-cube-form-brands">
					{BRAND_SUGGESTIONS.map((suggestion) => (
						<option key={suggestion} value={suggestion} />
					))}
				</datalist>
			</label>

			<label className={b('check')}>
				<input type="checkbox" checked={isSmart} onChange={(e) => setIsSmart(e.target.checked)} />
				<span className={b('check-text')}>
					<span>{t('cubes.form_is_smart')}</span>
					{isSmart ? <span className={b('note')}>{t('cubes.form_smart_note')}</span> : null}
				</span>
			</label>

			{!editing && puzzleHasCubes ? (
				<label className={b('check')}>
					<input type="checkbox" checked={makeMain} onChange={(e) => setMakeMain(e.target.checked)} />
					<span className={b('check-text')}>
						<span>{t('cubes.form_make_main')}</span>
					</span>
				</label>
			) : null}

			{error ? (
				<p className={b('error')} role="alert">
					{error}
				</p>
			) : null}

			<div className={b('actions')}>
				<Button type="button" text={t('cubes.form_cancel')} gray large={!!mobileMode} onClick={close} disabled={saving} />
				<Button type="submit" text={t('cubes.form_save')} primary large={!!mobileMode} loading={saving} />
			</div>
		</form>
	);
}
