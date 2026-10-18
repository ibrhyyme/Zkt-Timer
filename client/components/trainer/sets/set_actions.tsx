/**
 * The set actions My Sets and the set page share: create, edit, delete, reset link, the "..."
 * menu. Sheets open through openModal (outside the trainer provider), so every request is
 * passed in as a callback from here, and the list state (lib/alg_sets/store) and the device copy
 * (loader.rememberAlgSet / forgetAlgSet) are kept in step in one place.
 */
import React, {useCallback} from 'react';
import {useDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {openModal} from '../../../actions/general';
import ConfirmModal from '../../common/confirm_modal/ConfirmModal';
import {createAlgSet, deleteAlgSet, resetAlgSetCode, unsaveAlgSet, updateAlgSet} from '../../../lib/alg_sets/api';
import {forgetAlgSet, rememberAlgSet} from '../../../lib/alg_sets/loader';
import {removeOwnSet, removeSavedSet, upsertOwnSet} from '../../../lib/alg_sets/store';
import {getGqlErrorMessage} from '../../../util/gql-error';
import EditSetSheet, {type EditSetValues} from './EditSetSheet';
import {ActionSheet, type SheetAction} from './parts';
import type {AlgSetData, AlgSetItemData, AlgSetSummaryData} from '../../../lib/alg_sets/types';

const SHEET_WIDTH = 460;

export function useSetActions() {
	const {t} = useTranslation();
	const dispatch = useDispatch();

	const openMenu = useCallback(
		(title: string, actions: SheetAction[], message?: string) => {
			dispatch(
				openModal(<ActionSheet actions={actions} message={message} />, {title, width: SHEET_WIDTH, compact: true})
			);
		},
		[dispatch]
	);

	/** "New set": creates it and hands the new set over (the caller opens the picker). */
	const openCreate = useCallback(
		(onCreated: (set: AlgSetData) => void) => {
			const submit = async (values: EditSetValues) => {
				const set = await createAlgSet(values);
				upsertOwnSet(set);
				rememberAlgSet(set);
				onCreated(set);
			};
			dispatch(
				openModal(<EditSetSheet mode="create" onSubmit={submit} />, {
					title: t('trainer.sets.new'),
					width: SHEET_WIDTH,
					disableBackdropClick: true,
				})
			);
		},
		[dispatch, t]
	);

	/**
	 * "Edit": name, description, sharing. `rows` are kept on the returned set (the update answers
	 * without rows).
	 */
	const openEdit = useCallback(
		(set: AlgSetSummaryData, rows: AlgSetItemData[] | null, onSaved?: (next: AlgSetData) => void) => {
			const submit = async (values: EditSetValues) => {
				const next = await updateAlgSet(set.id, values, rows || []);
				upsertOwnSet(next);
				if (rows) rememberAlgSet({...next, is_owner: true});
				if (onSaved) onSaved({...next, is_owner: true});
			};
			dispatch(
				openModal(
					<EditSetSheet
						mode="edit"
						initial={{name: set.name, description: set.description, visibility: set.visibility}}
						saveCount={set.save_count}
						hidden={set.hidden}
						onSubmit={submit}
					/>,
					{title: t('trainer.sets.edit'), width: SHEET_WIDTH, disableBackdropClick: true}
				)
			);
		},
		[dispatch, t]
	);

	const confirmDelete = useCallback(
		(set: {id: string; name: string}, onDeleted?: () => void) => {
			const trigger = async () => {
				try {
					await deleteAlgSet(set.id);
				} catch (err) {
					throw new Error(getGqlErrorMessage(err, t, 'trainer.sets.load_error'));
				}
				removeOwnSet(set.id);
				forgetAlgSet(set.id);
				if (onDeleted) onDeleted();
			};
			dispatch(
				openModal(<ConfirmModal hideInput buttonText={t('trainer.sets.delete')} triggerAction={trigger} />, {
					title: t('trainer.sets.delete'),
					description: t('trainer.sets.delete_confirm', {name: set.name}),
					width: 420,
					compact: true,
				})
			);
		},
		[dispatch, t]
	);

	const confirmResetLink = useCallback(
		(set: AlgSetData, onReset: (next: AlgSetData) => void) => {
			const trigger = async () => {
				let next: AlgSetData;
				try {
					next = await resetAlgSetCode(set.id, set.items);
				} catch (err) {
					throw new Error(getGqlErrorMessage(err, t, 'trainer.sets.load_error'));
				}
				const full = {...next, is_owner: true};
				upsertOwnSet(full);
				rememberAlgSet(full);
				onReset(full);
			};
			dispatch(
				openModal(
					<ConfirmModal
						hideInput
						buttonText={t('trainer.sets.reset_link')}
						buttonProps={{danger: false, primary: true}}
						triggerAction={trigger}
					/>,
					{
						title: t('trainer.sets.reset_link'),
						description: t('trainer.sets.reset_link_confirm'),
						width: 420,
						compact: true,
					}
				)
			);
		},
		[dispatch, t]
	);

	/** "Remove from my list" for a saved set (works for an unavailable one too). */
	const unsave = useCallback(
		async (setId: string) => {
			await unsaveAlgSet(setId);
			removeSavedSet(setId);
			forgetAlgSet(setId);
		},
		[]
	);

	return {openMenu, openCreate, openEdit, confirmDelete, confirmResetLink, unsave};
}
