import React, {useState, useEffect, useCallback} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {toastSuccess, toastError} from '../../../../util/toast';
import {b, getEventName} from '../shared';
import {useDispatch} from 'react-redux';
import {openModal} from '../../../../actions/general';
import {Plus, Minus, UserPlus, X, UsersThree} from 'phosphor-react';

const ROUND_ASSIGNMENTS = gql`
	query ZktRoundAssignmentsAdmin($roundId: String!) {
		zktRoundAssignments(roundId: $roundId) {
			id
			round_id
			group_id
			user_id
			role
			station_number
			user {
				id
				username
				profile {
					pfp_image {
						id
						url
					}
				}
			}
		}
	}
`;

const ASSIGN_USER = gql`
	mutation AssignUserAdmin($input: AssignUserInput!) {
		assignUserToRound(input: $input) {
			id
		}
	}
`;

const UNASSIGN_USER = gql`
	mutation UnassignUserAdmin($assignmentId: String!) {
		unassignUser(assignmentId: $assignmentId)
	}
`;

const CREATE_GROUP = gql`
	mutation CreateGroupAdmin($input: CreateGroupInput!) {
		createZktGroup(input: $input) {
			id
			group_number
		}
	}
`;

const DELETE_GROUP = gql`
	mutation DeleteGroupAdmin($groupId: String!) {
		deleteZktGroup(groupId: $groupId)
	}
`;

const BULK_ASSIGN = gql`
	mutation BulkAssignAdmin($input: BulkAssignCompetitorsInput!) {
		bulkAssignCompetitors(input: $input) {
			id
		}
	}
`;

const USER_SEARCH = gql`
	query AssignmentUserSearch($pageArgs: PaginationArgsInput) {
		userSearch(pageArgs: $pageArgs) {
			items {
				id
				username
				profile {
					pfp_image { id url }
				}
			}
		}
	}
`;

const ROLE_LABELS: Record<string, string> = {
	COMPETITOR: 'Yarışmacı',
	JUDGE: 'Hakem',
	SCRAMBLER: 'Karıştırıcı',
	RUNNER: 'Runner',
	ORGANIZER: 'Organizatör',
	STAFF: 'Staff',
};

const ROLE_COLORS: Record<string, string> = {
	COMPETITOR: 'rgba(45, 189, 97, 0.18)',
	JUDGE: 'rgba(66, 165, 245, 0.18)',
	SCRAMBLER: 'rgba(155, 89, 182, 0.18)',
	RUNNER: 'rgba(238, 106, 38, 0.18)',
	ORGANIZER: 'rgba(var(--primary-color), 0.18)',
	STAFF: 'rgba(var(--text-color), 0.12)',
};

interface AssignmentItem {
	id: string;
	round_id: string;
	group_id?: string;
	user_id: string;
	role: string;
	station_number?: number;
	user?: {id: string; username: string; profile?: {pfp_image?: {url: string}}};
}

export default function DashboardAssignments({
	detail,
	onUpdated,
}: {
	detail: any;
	onUpdated: () => void;
}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const dispatch = useDispatch();

	const [selectedEventId, setSelectedEventId] = useState<string>(detail.events[0]?.id || '');
	const [selectedRoundId, setSelectedRoundId] = useState<string>('');
	const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
	const [loading, setLoading] = useState(false);

	const selectedEvent = detail.events.find((e: any) => e.id === selectedEventId);

	useEffect(() => {
		if (selectedEvent && selectedEvent.rounds.length > 0) {
			setSelectedRoundId(selectedEvent.rounds[0].id);
		}
	}, [selectedEventId, selectedEvent]);

	const selectedRound = selectedEvent?.rounds.find((r: any) => r.id === selectedRoundId);

	const fetchAssignments = useCallback(async () => {
		if (!selectedRoundId) return;
		setLoading(true);
		try {
			const res = await gqlMutate(ROUND_ASSIGNMENTS, {roundId: selectedRoundId});
			setAssignments(res?.data?.zktRoundAssignments || []);
		} catch {
			setAssignments([]);
		} finally {
			setLoading(false);
		}
	}, [selectedRoundId]);

	useEffect(() => {
		fetchAssignments();
	}, [fetchAssignments]);

	// Groups from detail (round'daki gruplar)
	const groups: any[] = selectedRound?.groups || [];

	async function addGroup() {
		if (!selectedRoundId) return;
		const nextNum = groups.length > 0 ? Math.max(...groups.map((g: any) => g.group_number)) + 1 : 1;
		try {
			await gqlMutate(CREATE_GROUP, {input: {roundId: selectedRoundId, groupNumber: nextNum}});
			toastSuccess(t('group_added'));
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function removeGroup(groupId: string) {
		try {
			await gqlMutate(DELETE_GROUP, {groupId});
			toastSuccess(t('group_deleted'));
			onUpdated();
			fetchAssignments();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function assignUser(roundId: string, groupId: string | null, userId: string, role: string) {
		try {
			await gqlMutate(ASSIGN_USER, {
				input: {roundId, groupId, userId, role},
			});
			fetchAssignments();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function unassign(assignmentId: string) {
		try {
			await gqlMutate(UNASSIGN_USER, {assignmentId});
			fetchAssignments();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function autoDist() {
		if (!selectedRoundId || !selectedEvent) return;
		const approved = detail.registrations
			.filter(
				(r: any) =>
					r.status === 'APPROVED' &&
					r.events.some((e: any) => e.comp_event_id === selectedEvent.id)
			)
			.map((r: any) => r.user_id);

		if (approved.length === 0) {
			toastError(t('no_competitors'));
			return;
		}

		const groupCount = Math.max(groups.length, 1);
		try {
			await gqlMutate(BULK_ASSIGN, {
				input: {roundId: selectedRoundId, groupCount, userIds: approved},
			});
			toastSuccess(t('auto_distributed'));
			onUpdated();
			fetchAssignments();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	function openUserSearch(roundId: string, groupId: string | null, role: string) {
		dispatch(
			openModal(<UserSearchModal roundId={roundId} groupId={groupId} role={role} onAssign={assignUser} />)
		);
	}

	// Grup bazlı assignments
	function getGroupAssignments(groupId: string, role: string) {
		return assignments.filter((a) => a.group_id === groupId && a.role === role);
	}

	// Round bazlı (grupsuz) assignments
	function getRoundAssignments(role: string) {
		return assignments.filter((a) => !a.group_id && a.role === role);
	}

	if (!selectedEvent) return <div className={b('empty')}>{t('no_events')}</div>;

	return (
		<div>
			{/* Event + Round selector */}
			<div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem'}}>
				{detail.events.map((ev: any) => (
					<button
						key={ev.id}
						className={b('filter-pill', {active: selectedEventId === ev.id})}
						onClick={() => setSelectedEventId(ev.id)}
					>
						<span className={`cubing-icon event-${ev.event_id}`} />
						{getEventName(ev.event_id)}
					</button>
				))}
			</div>

			{selectedEvent.rounds.length > 0 && (
				<div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem'}}>
					{selectedEvent.rounds.map((r: any) => (
						<button
							key={r.id}
							className={b('filter-pill', {active: selectedRoundId === r.id})}
							onClick={() => setSelectedRoundId(r.id)}
						>
							{t('round_n', {n: r.round_number})}
						</button>
					))}
				</div>
			)}

			{/* Actions bar */}
			<div style={{display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap'}}>
				<button className={b('action-btn', {primary: true})} onClick={autoDist}>
					<UsersThree weight="bold" /> {t('auto_distribute')}
				</button>
				<button className={b('action-btn')} onClick={addGroup}>
					<Plus weight="bold" /> {t('add_group')}
				</button>
			</div>

			{/* Groups grid */}
			{groups.length === 0 ? (
				<div className={b('empty')}>{t('no_groups')}</div>
			) : (
				<div className={b('event-card-grid')}>
					{groups.map((group: any) => (
						<div key={group.id} className={b('event-pane')}>
							<div className={b('event-pane-header')}>
								<div className={b('event-pane-title')}>
									{t('group_n', {n: group.group_number})}
								</div>
								<button
									className={b('round-count-btn')}
									onClick={() => removeGroup(group.id)}
									title={t('delete_group')}
								>
									<Minus weight="bold" />
								</button>
							</div>

							{/* Competitors */}
							<RoleSection
								label={t('role_competitor')}
								color={ROLE_COLORS.COMPETITOR}
								assignments={getGroupAssignments(group.id, 'COMPETITOR')}
								onRemove={unassign}
								onAdd={() => openUserSearch(selectedRoundId, group.id, 'COMPETITOR')}
							/>

							{/* Judges */}
							<RoleSection
								label={t('role_judge')}
								color={ROLE_COLORS.JUDGE}
								assignments={getGroupAssignments(group.id, 'JUDGE')}
								onRemove={unassign}
								onAdd={() => openUserSearch(selectedRoundId, group.id, 'JUDGE')}
							/>

							{/* Scramblers */}
							<RoleSection
								label={t('role_scrambler')}
								color={ROLE_COLORS.SCRAMBLER}
								assignments={getGroupAssignments(group.id, 'SCRAMBLER')}
								onRemove={unassign}
								onAdd={() => openUserSearch(selectedRoundId, group.id, 'SCRAMBLER')}
							/>

							{/* Runners */}
							<RoleSection
								label={t('role_runner')}
								color={ROLE_COLORS.RUNNER}
								assignments={getGroupAssignments(group.id, 'RUNNER')}
								onRemove={unassign}
								onAdd={() => openUserSearch(selectedRoundId, group.id, 'RUNNER')}
							/>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function RoleSection({
	label,
	color,
	assignments,
	onRemove,
	onAdd,
}: {
	label: string;
	color: string;
	assignments: AssignmentItem[];
	onRemove: (id: string) => void;
	onAdd: () => void;
}) {
	return (
		<div style={{marginBottom: '0.75rem'}}>
			<div
				style={{
					fontSize: 12,
					fontWeight: 700,
					textTransform: 'uppercase' as const,
					letterSpacing: 0.5,
					padding: '0.3rem 0.6rem',
					borderRadius: 4,
					background: color,
					color: 'rgb(var(--text-color))',
					marginBottom: '0.35rem',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
				}}
			>
				<span>{label} ({assignments.length})</span>
				<button
					onClick={onAdd}
					style={{
						border: 'none',
						background: 'transparent',
						color: 'rgb(var(--text-color))',
						cursor: 'pointer',
						padding: '2px',
						display: 'flex',
					}}
				>
					<UserPlus size={16} weight="bold" />
				</button>
			</div>
			{assignments.map((a) => (
				<div
					key={a.id}
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '0.5rem',
						padding: '0.3rem 0.6rem',
						fontSize: 13,
						color: 'rgb(var(--text-color))',
					}}
				>
					{a.user?.profile?.pfp_image?.url && (
						<img
							src={a.user.profile.pfp_image.url}
							alt=""
							style={{width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' as const}}
						/>
					)}
					<span style={{flex: 1}}>{a.user?.username || a.user_id}</span>
					{a.station_number && (
						<span style={{fontSize: 11, color: 'rgba(var(--text-color), 0.6)'}}>#{a.station_number}</span>
					)}
					<button
						onClick={() => onRemove(a.id)}
						style={{
							border: 'none',
							background: 'transparent',
							color: 'rgba(var(--text-color), 0.5)',
							cursor: 'pointer',
							padding: '2px',
							display: 'flex',
						}}
					>
						<X size={14} weight="bold" />
					</button>
				</div>
			))}
		</div>
	);
}

function UserSearchModal({
	roundId,
	groupId,
	role,
	onAssign,
}: {
	roundId: string;
	groupId: string | null;
	role: string;
	onAssign: (roundId: string, groupId: string | null, userId: string, role: string) => void;
}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const [search, setSearch] = useState('');
	const [users, setUsers] = useState<any[]>([]);

	useEffect(() => {
		if (search.length < 2) {
			setUsers([]);
			return;
		}
		const handle = setTimeout(async () => {
			try {
				const res = await gqlMutate(USER_SEARCH, {
					pageArgs: {page: 0, pageSize: 10, searchQuery: search},
				});
				setUsers(res?.data?.userSearch?.items || []);
			} catch {
				// ignore
			}
		}, 300);
		return () => clearTimeout(handle);
	}, [search]);

	function handleSelect(userId: string) {
		onAssign(roundId, groupId, userId, role);
	}

	return (
		<div className={b('modal-content')}>
			<h2 className={b('modal-title')}>
				{ROLE_LABELS[role] || role} {t('assign')}
			</h2>
			<div className={b('field')}>
				<input
					className={b('input')}
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder={t('search_user_placeholder')}
					autoFocus
				/>
			</div>
			{users.length > 0 && (
				<div className={b('user-list')}>
					{users.map((u) => (
						<button
							key={u.id}
							type="button"
							className={b('user-row')}
							onClick={() => handleSelect(u.id)}
						>
							{u.profile?.pfp_image?.url && (
								<img className={b('user-avatar')} src={u.profile.pfp_image.url} alt="" />
							)}
							<span className={b('user-name')}>{u.username}</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
