import React, { useCallback, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Archive, ArrowCounterClockwise, PencilSimple, Star, Trash } from 'phosphor-react';
import { openModal } from '../../../actions/general';
import { IModalProps } from '../../common/modal/Modal';
import { toastError } from '../../../util/toast';
import { LocalCube } from '../../../lib/cubes/active_cube';
import { chooseMainCube, setCubeArchivedOnline } from '../../../lib/cubes/sync';
import CubeForm from './CubeForm';
import CubeDeleteDialog from './CubeDeleteDialog';
import { cubeErrorMessage } from './cube_errors';

/**
 * Forms and dialogs open as a bottom sheet on phones and a centred modal elsewhere (5.2). Same cut-off
 * as useIsMobile and $bp-md; read at open time, the sheet does not follow a later resize.
 */
export function sheetOptions(extra: IModalProps = {}): IModalProps {
	const phone = typeof window !== 'undefined' && window.innerWidth < 768;
	return phone ? { position: 'bottom', ...extra } : { width: 460, ...extra };
}

export interface CubeMenuItem {
	id: string;
	label: string;
	icon: React.ReactNode;
	danger?: boolean;
	onSelect: () => void;
}

export interface CubeActions {
	openAdd: (options?: { puzzle?: string | null; onSaved?: (cube: LocalCube) => void }) => void;
	openEdit: (cube: LocalCube) => void;
	makeMain: (cube: LocalCube) => void;
	setArchived: (cube: LocalCube, archived: boolean) => Promise<void>;
	openDelete: (cube: LocalCube, onDeleted?: () => void) => void;
	/** The context menu of a cube (5.1): Main yap, Düzenle, Arşivle / Arşivden çıkar, Sil. */
	menuItems: (cube: LocalCube, isMain: boolean, onDeleted?: () => void) => CubeMenuItem[];
}

/** Everything a cube row, the profile and the page do to a cube, with errors shown as toasts. */
export function useCubeActions(): CubeActions {
	const { t } = useTranslation();
	const dispatch = useDispatch();

	const openAdd = useCallback<CubeActions['openAdd']>(
		(options = {}) => {
			dispatch(openModal(<CubeForm puzzle={options.puzzle} onSaved={options.onSaved} />, sheetOptions()));
		},
		[dispatch]
	);

	const openEdit = useCallback(
		(cube: LocalCube) => {
			dispatch(openModal(<CubeForm cube={cube} />, sheetOptions()));
		},
		[dispatch]
	);

	// Applied at once and sent when possible (4.2): the badge moves without waiting for the server.
	const makeMain = useCallback((cube: LocalCube) => {
		if (cube.archived_at) return;
		chooseMainCube(cube.puzzle, cube.id);
	}, []);

	const setArchived = useCallback(
		async (cube: LocalCube, archived: boolean) => {
			try {
				await setCubeArchivedOnline(cube.id, archived);
			} catch (err) {
				toastError(cubeErrorMessage(err, t));
			}
		},
		[t]
	);

	const openDelete = useCallback(
		(cube: LocalCube, onDeleted?: () => void) => {
			dispatch(openModal(<CubeDeleteDialog cube={cube} onDeleted={onDeleted} />, sheetOptions({ width: 420 })));
		},
		[dispatch]
	);

	const menuItems = useCallback<CubeActions['menuItems']>(
		(cube, isMain, onDeleted) => {
			const items: CubeMenuItem[] = [];
			if (!cube.archived_at && !isMain) {
				items.push({
					id: 'main',
					label: t('cubes.action_make_main'),
					icon: <Star weight="bold" />,
					onSelect: () => makeMain(cube),
				});
			}
			items.push({
				id: 'edit',
				label: t('cubes.action_edit'),
				icon: <PencilSimple weight="bold" />,
				onSelect: () => openEdit(cube),
			});
			items.push(
				cube.archived_at
					? {
						id: 'unarchive',
						label: t('cubes.action_unarchive'),
						icon: <ArrowCounterClockwise weight="bold" />,
						onSelect: () => void setArchived(cube, false),
					}
					: {
						id: 'archive',
						label: t('cubes.action_archive'),
						icon: <Archive weight="bold" />,
						onSelect: () => void setArchived(cube, true),
					}
			);
			items.push({
				id: 'delete',
				label: t('cubes.action_delete'),
				icon: <Trash weight="bold" />,
				danger: true,
				onSelect: () => openDelete(cube, onDeleted),
			});
			return items;
		},
		[t, makeMain, openEdit, setArchived, openDelete]
	);

	return useMemo(
		() => ({ openAdd, openEdit, makeMain, setArchived, openDelete, menuItems }),
		[openAdd, openEdit, makeMain, setArchived, openDelete, menuItems]
	);
}
