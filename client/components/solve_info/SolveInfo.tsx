import React, { useEffect, useState } from 'react';
import { getTimeString } from '../../util/time';
import './SolveInfo.scss';
import { Cube, Bluetooth } from 'phosphor-react';
import HorizontalNav from '../common/horizontal_nav/HorizontalNav';
import ScrambleInfo from './scramble_info/ScrambleInfo';
import SolutionInfo from './solution_info/SolutionInfo';
import StatsInfo from './stats_info/StatsInfo';
import NotesInfo from './notes_info/NotesInfo';
import { gql } from '@apollo/client';
import { gqlQuery } from '../api';
import Loading from '../common/loading/Loading';
import { SOLVE_WITH_USER_FRAGMENT } from '../../util/graphql/fragments';
import CopyText from '../common/copy_text/CopyText';
import Avatar from '../common/avatar/Avatar';
import { toggleDnfSolveDb, togglePlusTwoSolveDb } from '../../db/solves/operations';
import { fetchSolve, fetchAdjacentSolve } from '../../db/solves/query';
import { deleteSolveDb, updateSolveDb } from '../../db/solves/update';
import { useSolveDb } from '../../util/hooks/useSolveDb';
import { IModalProps } from '../common/modal/Modal';
import { getCubeTypeInfoById } from '../../util/cubes/util';
import block from '../../styles/bem';
import Button from '../common/button/Button';
import Tag from '../common/tag/Tag';
import { Solve } from '../../../server/schemas/Solve.schema';
import { getFullFormattedDate } from '../../util/dates';
import { useGeneral } from '../../util/hooks/useGeneral';
import { useDispatch } from 'react-redux';
import { closeModal } from '../../actions/general';
import { demoUser } from './demo_user';

const b = block('solve-info');

interface Props extends IModalProps {
	solveId: string;
	solve?: Solve;
	disabled?: boolean;
	closeModal?: () => void;
}

export default function SolveInfo(props: Props) {
	const { solveId, disabled, onComplete } = props;

	const dispatch = useDispatch();
	const mobileMode = useGeneral('mobile_mode');
	const demoSolve = props.solve?.demo_mode;

	const [page, setPage] = useState('scramble');
	const [loading, setLoading] = useState(!demoSolve);
	const [solve, setSolve] = useState<Solve>(props.solve);
	const [editMode, setEditMode] = useState(false);
	const [dbSolve, setDbSolve] = useState<Solve>(null);

	useSolveDb();
	useEffect(() => {
		if (demoSolve) {
			return;
		}

		updateSolve();
	}, []);

	let user = solve?.user;
	if (solve?.demo_mode) {
		user = demoUser;
	}

	function updateSolve(targetSolveId?: string) {
		const id = targetSolveId || solveId;
		const query = gql`
			${SOLVE_WITH_USER_FRAGMENT}

			query Query($id: String) {
				solve(id: $id) {
					...SolveWithUserFragment
				}
			}
		`;

		const solveQuery = gqlQuery<{ solve: Solve }>(
			query,
			{
				id,
			},
			'no-cache'
		);

		solveQuery.then((res) => {
			setDbSolve(fetchSolve(id));
			setSolve(res.data.solve);
			setLoading(false);
		});
	}

	function togglePlusTwo() {
		togglePlusTwoSolveDb(dbSolve);
	}

	function toggleDnf() {
		toggleDnfSolveDb(dbSolve);
	}

	async function deleteSolve() {
		const solveToDelete = dbSolve || solve;
		if (!solveToDelete) return;

		// Silmeden ÖNCE bir sonraki çözümü al
		const adjacentSolve = fetchAdjacentSolve(solveToDelete);

		// confirmed: true ile geçiyoruz çünkü zaten modal içindeyiz
		// iç içe modal açmak sorun yaratıyor
		await deleteSolveDb(solveToDelete, true);

		// Eğer bir sonraki çözüm varsa ona geç
		if (adjacentSolve) {
			setLoading(true);
			updateSolve(adjacentSolve.id);
		} else {
			// Son çözüm silinmiş, modal'ı kapat
			onComplete?.();
		}
	}

	function handleChange(e) {
		updateSolveDb(dbSolve, {
			[e.target.name]: e.target.value,
		});
	}

	function onPageChange(id) {
		setPage(id);
	}

	function toggleEditMode() {
		if (editMode) {
			updateSolve();
		}

		setEditMode(!editMode);
	}

	if (loading) {
		return (
			<div className={b()}>
				<Loading />
			</div>
		);
	}

	const effSolve = dbSolve || solve;

	const plusTwo = effSolve.plus_two;
	const dnf = effSolve.dnf;
	const cubeType = solve.cube_type;
	const endedAt = new Date(Number(solve.ended_at));
	const isSmartCube = solve.is_smart_cube;
	const smartDevice = solve.smart_device;
	const isSystemDnf = effSolve.dnf && effSolve.raw_time === 0; // Inspection timeout DNF'i

	const time = getTimeString(effSolve.time);

	const childBody = {
		editMode,
		solve,
		handleChange,
	};

	const pageMap = {
		scramble: <ScrambleInfo {...childBody} />,
		solution: <SolutionInfo {...childBody} />,
		stats: <StatsInfo {...childBody} />,
		notes: <NotesInfo {...childBody} />,
	};

	const infoBody = pageMap[page];

	let editButton = (
		<Button
			text={editMode ? 'Kaydet' : 'Düzenle'}
			className={b('edit')}
			gray
			primary={editMode}
			onClick={toggleEditMode}
		/>
	);

	let plusTwoButton = <Button gray text="+2" disabled={disabled || isSystemDnf} onClick={togglePlusTwo} warning={plusTwo} />;
	let dnfButton = <Button gray text="DNF" disabled={disabled || isSystemDnf} onClick={toggleDnf} danger={dnf} />;
	let deleteButton = <Button gray title="Çözümü sil" text="Sil" onClick={deleteSolve} />;

	if (disabled) {
		deleteButton = null;
		editButton = null;
		plusTwoButton = null;
		dnfButton = null;

		if (plusTwo) {
			plusTwoButton = <Tag text="+2" backgroundColor="orange" />;
		}
		if (dnf) {
			dnfButton = <Tag text="DNF" backgroundColor="red" />;
		}
	}

	let smartPages = [
		{
			id: 'solution',
			value: 'Çözüm',
		},
		{
			id: 'stats',
			value: 'İstatistikler',
		},
	];

	if (!isSmartCube) {
		smartPages = [];
	}

	const pages = [
		{
			id: 'scramble',
			value: 'Karıştırma',
		},
		...smartPages,
		{
			id: 'notes',
			value: 'Notlar',
		},
	];

	let shareLink = null;
	if (typeof window !== 'undefined') {
		shareLink = (
			<CopyText
				buttonProps={{
					text: 'Linki Paylaş',
				}}
				text={window.location.origin + '/solve/' + solve.share_code}
			/>
		);
	}

	const cubeTypeInfo = getCubeTypeInfoById(cubeType);

	function handleDone() {
		dispatch(closeModal());
	}

	return (
		<div className={b({ mobile: mobileMode })}>
			{mobileMode && (
				<div className={b('mobile-header-top')}>
					<div className={b('mobile-title')}>Çözüm Detayı</div>
					<div className={b('mobile-done')} onClick={handleDone}>Bitti</div>
				</div>
			)}
			{!mobileMode && (
				<div className={b('web-done')} onClick={handleDone}>Bitti</div>
			)}
			<div className={b('top-actions')}>
				<div>{shareLink}</div>
				<div>
					{deleteButton}
					{editButton}
				</div>
			</div>
			<div className={b('body')}>
				<h2>{time}</h2>
				<div className={b('sub')}>
					<Avatar small user={user} hideBadges profile={user?.profile} />
					<div className={b('sub-actions')}>
						{isSmartCube ? (
							<Tag
								icon={<Bluetooth />}
								text={smartDevice?.name}
								title="Smart cube"
								large
								backgroundColor="blue"
							/>
						) : null}

						<Tag icon={<Cube weight="bold" />} backgroundColor="button" text={cubeTypeInfo.name} />
						{plusTwoButton}
						{dnfButton}
					</div>
					<div className={b('date-info')}>
						<span>{getFullFormattedDate(endedAt)}</span>
					</div>
				</div>
				<div className={b('info')}>
					<div className={b('nav')}>
						<HorizontalNav tabId={page} onChange={onPageChange} tabs={pages} />
					</div>
					{infoBody}
				</div>
			</div>
		</div>
	);
}
