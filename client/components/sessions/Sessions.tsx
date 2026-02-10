import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import './Sessions.scss';
import { Plus, CaretDown } from 'phosphor-react';
import CubePicker from '../common/cube_picker/CubePicker';
import TimeChart from '../modules/time_chart/TimeChart';
import History from '../modules/history/History';
import Input from '../common/inputs/input/Input';
import { openModal } from '../../actions/general';
import CreateNewSession from './new_session/CreateNewSession';
import { SortableContainer, SortableElement } from 'react-sortable-hoc';
import arrayMove from 'array-move';
import Session from './session/Session';
import { fetchSessionById, fetchSessions, getCubeTypesFromSession } from '../../db/sessions/query';
import { fetchLastCubeTypeForSession } from '../../db/solves/query';
import { reorderSessions, updateSessionDb, createSessionDb, deleteSessionDb, mergeSessionsDb } from '../../db/sessions/update';
import { useGeneral } from '../../util/hooks/useGeneral';
import block from '../../styles/bem';
import { useSessionDb } from '../../util/hooks/useSessionDb';
import { CubeType } from '../../util/cubes/cube_types';
import PageTitle from '../common/page_title/PageTitle';
import Button from '../common/button/Button';
import Module from '../common/module/Module';
import TimeDistro from '../modules/time_distro/TimeDistro';
import { useSettings } from '../../util/hooks/useSettings';
import { setCubeType, setCurrentSession } from '../../db/settings/update';
import { v4 as uuid } from 'uuid';
import ConfirmModal from '../common/confirm_modal/ConfirmModal';
import { toastSuccess, toastError } from '../../util/toast';
import Dropdown from '../common/inputs/dropdown/Dropdown';

const b = block('sessions');

interface SortableItemProps {
	session: any;
	selectedSessionId: string;
	selectSession: (e: any, id: any) => void;
	setSelectedSessionId: React.Dispatch<React.SetStateAction<string>>;
	multiSelectedIds: Set<string>;
}

interface SortableListProps {
	sessions: any[];
	selectedSessionId: string;
	selectSession: (e: any, id: any) => void;
	setSelectedSessionId: React.Dispatch<React.SetStateAction<string>>;
	multiSelectedIds: Set<string>;
}

const SortableItem = SortableElement<SortableItemProps>(({ session, selectedSessionId, selectSession, setSelectedSessionId, multiSelectedIds }) => (
	<Session
		setSelectedSessionId={setSelectedSessionId}
		session={session}
		selectedSessionId={selectedSessionId}
		selectSession={selectSession}
		isMultiSelected={multiSelectedIds.has(session.id)}
	/>
));

const SortableList = SortableContainer<SortableListProps>(({ sessions, selectedSessionId, selectSession, setSelectedSessionId, multiSelectedIds }) => {
	return (
		<div className={b('list')}>
			{sessions.map((s, index) => (
				<SortableItem
					setSelectedSessionId={setSelectedSessionId}
					session={s}
					selectedSessionId={selectedSessionId}
					selectSession={selectSession}
					multiSelectedIds={multiSelectedIds}
					key={s.id}
					index={index}
				/>
			))}
		</div>
	);
});

export default function Sessions() {
	const dispatch = useDispatch();

	useSessionDb();

	const mobileMode = useGeneral('mobile_mode');
	const currentSessionId = useSettings('session_id');

	const [selectedSessionId, setSelectedSessionId] = useState<string>(currentSessionId);
	const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
	const [pendingBulkDelete, setPendingBulkDelete] = useState<string[] | null>(null);
	const [cubeType, setCubeType] = useState('');
	const [isEditingName, setIsEditingName] = useState(false);
	const [tempSessionName, setTempSessionName] = useState('');

	const allSessions = fetchSessions();
	let session = fetchSessionById(selectedSessionId);

	// Fallback mechanism: If selected session is missing, try to find a valid one
	if (!session && allSessions.length > 0) {
		session = fetchSessionById(currentSessionId);
		if (!session) {
			session = allSessions[0];
		}
	}

	useEffect(() => {
		if (session && session.id !== selectedSessionId) {
			setSelectedSessionId(session.id);
		}
	}, [session, selectedSessionId]);

	function selectSession(e, id) {
		let target = e?.target;
		while (target) {
			if (target && target.classList && target.classList.contains(block('common-dropdown')())) {
				return;
			}

			target = target.parentNode;
		}

		// Ctrl+Click: çoklu seçim
		if (e && (e.ctrlKey || e.metaKey)) {
			setMultiSelectedIds((prev) => {
				const next = new Set(prev);
				if (next.has(id)) {
					next.delete(id);
				} else {
					next.add(id);
				}
				return next;
			});
			return;
		}

		// Normal tıklama: çoklu seçimi temizle
		setMultiSelectedIds(new Set());
		setSelectedSessionId(id);
		setIsEditingName(false);

		const lastCubeType = fetchLastCubeTypeForSession(id);
		setCubeType(lastCubeType || '333');
	}

	function handleCubeChange(ct: CubeType) {
		setCubeType(ct.id);
	}

	function startEditingName() {
		setTempSessionName(session.name);
		setIsEditingName(true);
	}

	function saveSessionName() {
		updateSessionDb(session, {
			name: tempSessionName,
		});
		setIsEditingName(false);
	}

	function handleNameChange(e) {
		setTempSessionName(e.target.value);
	}

	function openCreateNewSession() {
		dispatch(
			openModal(<CreateNewSession />, {
				onComplete: (session) => {
					setSelectedSessionId(session.id);
				},
			})
		);
	}

	function onSortEnd({ oldIndex, newIndex }) {
		const sessions = arrayMove(allSessions, oldIndex, newIndex);
		const sessionIds = sessions.map((s) => s.id);

		reorderSessions(sessionIds);
	}

	function makeCurrent() {
		const lastCubeType = fetchLastCubeTypeForSession(selectedSessionId) || '333';
		setCurrentSession(selectedSessionId);
		setCubeType(lastCubeType);
	}

	async function mergeSessions() {
		const currentSession = fetchSessionById(currentSessionId);
		dispatch(
			openModal(
				<ConfirmModal
					title="Sezonları Birleştir"
					description={`Dikkatli olun. "${session.name}" sezonunu "${currentSession.name}" içine birleştirmek üzeresiniz. "${session.name}" birleştirme sonrası silinecek.`}
					triggerAction={async () => {
						await mergeSessionsDb(selectedSessionId, currentSessionId);
						setSelectedSessionId(currentSessionId);
					}}
					buttonText="Sezonları Birleştir"
					buttonProps={{
						danger: true,
					}}
				/>
			)
		);
	}

	async function deleteSession() {
		if (allSessions.length <= 1) {
			toastError("Son kalan sezonu silemezsiniz!");
			return;
		}

		async function triggerAction() {
			const id = session.id;
			const name = session.name;
			let updatedSessionId = currentSessionId;

			if (currentSessionId === id) {
				const newId = uuid();

				await createSessionDb({
					name: 'Yeni Sezon',
					id: newId,
				});

				setCurrentSession(newId);
				setCubeType('333');

				updatedSessionId = newId;
			}

			setSelectedSessionId(updatedSessionId);
			await deleteSessionDb(session);
			toastSuccess(`"${name}" sezonu başarıyla silindi`);
		}

		dispatch(
			openModal(
				<ConfirmModal
					title="Sezonu Sil"
					description={`Dikkatli olun. "${session.name}" sezonunu silmek üzeresiniz. Bu işlem geri alınamaz.`}
					triggerAction={triggerAction}
					buttonText="Sezonu Sil"
				/>
			)
		);
	}

	async function deleteSelectedSessions() {
		const idsToDelete = Array.from(multiSelectedIds);
		const remainingCount = allSessions.length - idsToDelete.length;

		if (remainingCount < 1) {
			toastError("Tüm sezonları silemezsiniz! En az bir sezon kalmalıdır.");
			return;
		}

		const sessionNames = idsToDelete
			.map((id) => allSessions.find((s) => s.id === id)?.name)
			.filter(Boolean)
			.join(', ');

		dispatch(
			openModal(
				<ConfirmModal
					title="Seçili Sezonları Sil"
					description={`${idsToDelete.length} sezon silinecek: ${sessionNames}. Bu işlem geri alınamaz.`}
					triggerAction={async () => {
						// İlk onay geçti, pending state'e kaydet — ikinci modal useEffect ile açılacak
						setPendingBulkDelete(idsToDelete);
					}}
					buttonText="Sezonları Sil"
					buttonProps={{
						danger: true,
					}}
				/>
			)
		);
	}

	// İkinci onay modalı: pendingBulkDelete set edildiğinde açılır
	useEffect(() => {
		if (!pendingBulkDelete) return;

		const idsToDelete = pendingBulkDelete;
		setPendingBulkDelete(null);

		dispatch(
			openModal(
				<ConfirmModal
					title="Emin misiniz?"
					description="Birden fazla sezon siliyorsunuz. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?"
					hideInput
					triggerAction={async () => {
						let updatedSessionId = currentSessionId;
						const deletingCurrent = idsToDelete.includes(currentSessionId);

						if (deletingCurrent) {
							const newId = uuid();
							await createSessionDb({
								name: 'Yeni Sezon',
								id: newId,
							});
							setCurrentSession(newId);
							setCubeType('333');
							updatedSessionId = newId;
						}

						for (const id of idsToDelete) {
							const ses = allSessions.find((s) => s.id === id);
							if (ses) {
								await deleteSessionDb(ses);
							}
						}

						setMultiSelectedIds(new Set());
						setSelectedSessionId(updatedSessionId);
						toastSuccess(`${idsToDelete.length} sezon başarıyla silindi`);
					}}
					buttonText="Evet, Sil"
					buttonProps={{
						danger: true,
					}}
				/>
			)
		);
	}, [pendingBulkDelete]);

	if (!session || !allSessions || !allSessions.length) {
		return null;
	}

	const sessionCubeTypes = getCubeTypesFromSession(session);
	const currentCube = String(cubeType || (session ? fetchLastCubeTypeForSession(session.id) : null) || '333');

	const fetchFilter = {
		session_id: selectedSessionId,
		cube_type: currentCube,
	};

	const isCurrentSession = selectedSessionId === currentSessionId;

	// TODO NOW fix session stats. Replace with QuickStats with proper options
	const body = (
		<div className={b('info')}>
			<Module>
				<div className={b('info-container')}>
					<h3 className={b('info-title')}>Sezon Ayarları</h3>

					{/* Sezon Adı */}
					<div className={b('info-section')}>
						<label className={b('info-label')}>Sezon Adı</label>
						{isEditingName ? (
							<Input
								type="text"
								noMargin
								maxWidth
								placeholder="Sezon İsmi Girin"
								value={tempSessionName}
								onChange={handleNameChange}
							/>
						) : (
							<div className={b('session-name-display')}>{session.name}</div>
						)}
					</div>

					{/* Aksiyon Butonları */}
					<div className={b('info-actions')}>
						{isEditingName ? (
							<Button
								text="Tamamlandı"
								onClick={saveSessionName}
								primary
								noMargin
							/>
						) : (
							<Button
								text="Yeniden Adlandır"
								onClick={startEditingName}
								primary
								noMargin
							/>
						)}
						{!isCurrentSession && !isEditingName && (
							<Button
								text="Geçerli Yap"
								onClick={makeCurrent}
								primary
								noMargin
							/>
						)}
						{!isCurrentSession && !isEditingName && (
							<Button
								text="Sezonu Birleştir"
								onClick={mergeSessions}
								warning
								noMargin
							/>
						)}
						{!isEditingName && (
							<Button
								text="Sezonu Sil"
								onClick={deleteSession}
								danger
								noMargin
							/>
						)}
						{!isEditingName && multiSelectedIds.size > 1 && (
							<Button
								text={`Seçili ${multiSelectedIds.size} Sezonu Sil`}
								onClick={deleteSelectedSessions}
								danger
								noMargin
							/>
						)}
					</div>
				</div>
			</Module>

			{/* İstatistikler Dropdown - Stats bölümünün başında */}
			<Module>
				<div className={b('stats-header')}>
					<div className={b('stats-picker')}>
						<label className={b('stats-label')}>İstatistikler</label>
						<CubePicker
							handlePrefix=""
							excludeSelected
							value={currentCube}
							cubeTypes={sessionCubeTypes}
							onChange={handleCubeChange}
							dropdownProps={{
								noMargin: true,
								dropdownButtonProps: {
									noMargin: true,
								},
							}}
						/>
					</div>
				</div>
			</Module>

			<div className={b('stats')}>
				{/*<Module smallPadding>*/}
				{/*	<SessionStats filterOptions={fetchFilter} />*/}
				{/*</Module>*/}
				<Module smallPadding>
					<History filterOptions={fetchFilter} />
				</Module>
				<Module smallPadding>
					<TimeChart filterOptions={fetchFilter} />
				</Module>
				<Module smallPadding>
					<TimeDistro filterOptions={fetchFilter} />
				</Module>
			</div>
		</div>
	);

	// Mobil için dropdown seçenekleri
	const sessionDropdownOptions = allSessions.map((ses) => ({
		text: ses.name,
		disabled: selectedSessionId === ses.id,
		onClick: () => selectSession(null, ses.id),
	}));

	return (
		<div className={b({ mobile: mobileMode })}>
			<PageTitle pageName="Sezonlar" />
			<div className={b('body')}>
				{mobileMode ? (
					// Mobil: Dropdown + Yeni Sezon butonu
					<div className={b('sessions-container')}>
						<Module>
							<div className={b('mobile-session-header')}>
								<div className={b('mobile-session-picker')}>
									<label className={b('mobile-session-label')}>Sezon Seç</label>
									<Dropdown
										noMargin
										text={session.name}
										icon={<CaretDown />}
										options={sessionDropdownOptions}
									/>
								</div>
								<Button
									primary
									glow
									text="Yeni Sezon"
									onClick={openCreateNewSession}
									type="button"
									icon={<Plus weight="bold" />}
									noMargin
								/>
							</div>
						</Module>
					</div>
				) : (
					// Desktop: Liste görünümü
					<div className={b('sessions-container')}>
						<Button
							primary
							glow
							large
							text="Yeni Sezon"
							onClick={openCreateNewSession}
							type="button"
							icon={<Plus weight="bold" />}
							noMargin
						/>
						<SortableList
							useDragHandle
							lockAxis="y"
							selectSession={selectSession}
							setSelectedSessionId={setSelectedSessionId}
							sessions={allSessions}
							selectedSessionId={selectedSessionId}
							multiSelectedIds={multiSelectedIds}
							onSortEnd={onSortEnd}
						/>
					</div>
				)}
				<div>{body}</div>
			</div>
		</div>
	);
}
