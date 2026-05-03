import React, { useEffect, useState } from 'react';
import { getTimeString } from '../../util/time';
import './SolveInfo.scss';
import { gql } from '@apollo/client';
import { gqlQuery } from '../api';
import Loading from '../common/loading/Loading';
import { SOLVE_WITH_USER_FRAGMENT } from '../../util/graphql/fragments';
import { toggleDnfSolveDb, togglePlusTwoSolveDb } from '../../db/solves/operations';
import { fetchSolve, fetchAdjacentSolve } from '../../db/solves/query';
import { deleteSolveDb, updateSolveDb } from '../../db/solves/update';
import { useSolveDb } from '../../util/hooks/useSolveDb';
import { IModalProps } from '../common/modal/Modal';
import { getCubeTypeBucketLabelWithCategory, getCubeTypeInfoById } from '../../util/cubes/util';
import block from '../../styles/bem';
import { Solve } from '../../../server/schemas/Solve.schema';
import { useGeneral } from '../../util/hooks/useGeneral';
import { useDispatch, useSelector } from 'react-redux';
import { closeModal } from '../../actions/general';
import NormalSolveLayout from './normal_solve_layout/NormalSolveLayout';
import SmartSolveLayout from './smart_solve_layout/SmartSolveLayout';
import { getSolveDb } from '../../db/solves/init';
import { emitEvent } from '../../util/event_handler';
import { toastError } from '../../util/toast';
import { useTranslation } from 'react-i18next';
import { canSync } from '../../lib/sync-gate';

const b = block('solve-info');

export interface SolveLayoutProps {
	solve: Solve;
	dbSolve: Solve;
	effSolve: Solve;
	user: any;
	disabled: boolean;
	editMode: boolean;
	mobileMode: boolean;
	toggleEditMode: () => void;
	togglePlusTwo: () => void;
	toggleDnf: () => void;
	deleteSolve: () => void;
	handleChange: (e: any) => void;
	handleDone: () => void;
	onComplete?: (data?: any) => void;
	time: string;
	cubeTypeInfo: any;
	endedAt: Date;
	isSystemDnf: boolean;
	plusTwo: boolean;
	dnf: boolean;
	smartDevice: any;
}

interface Props extends IModalProps {
	solveId: string;
	solve?: Solve;
	disabled?: boolean;
	closeModal?: () => void;
}

export default function SolveInfo(props: Props) {
	const { solveId, disabled, onComplete } = props;

	const { t } = useTranslation();
	const dispatch = useDispatch();
	const mobileMode = useGeneral('mobile_mode');
	const me = useSelector((state: any) => state.account.me);

	const [loading, setLoading] = useState(true);
	const [solve, setSolve] = useState<Solve>(props.solve);
	const [editMode, setEditMode] = useState(false);
	const [dbSolve, setDbSolve] = useState<Solve>(null);

	useSolveDb();
	useEffect(() => {
		updateSolve();
	}, []);

	const user = solve?.user || me;

	function updateSolve(targetSolveId?: string) {
		const id = targetSolveId || solveId;

		// Basic kullanici: sunucudan cekme, direkt lokal'den goster
		if (!canSync()) {
			const localSolve = fetchSolve(id);
			if (localSolve) {
				setDbSolve(localSolve);
				setSolve(localSolve);
			}
			setLoading(false);
			return;
		}

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
		}).catch((err) => {
			// Offline/network hatasi ise solve'u silme — sadece local veriyi goster
			const isOffline = err?.networkError?.statusCode === 503
				|| err?.message?.includes('Offline')
				|| err?.message?.includes('Failed to fetch')
				|| err?.message?.includes('Network request failed');

			if (isOffline) {
				const localSolve = fetchSolve(id);
				if (localSolve) {
					setDbSolve(localSolve);
					setSolve(localSolve);
					setLoading(false);
					return;
				}
			}

			// Gercek NOT_FOUND: baska cihazdan silinmis
			const localSolve = fetchSolve(id);
			if (localSolve) {
				getSolveDb().remove(localSolve);
				emitEvent('solveDbUpdatedEvent', localSolve);
			}

			toastError(t('solve_info.deleted_from_other_device'));
			onComplete ? onComplete() : dispatch(closeModal());
		});
	}

	function togglePlusTwo() {
		togglePlusTwoSolveDb(dbSolve);
	}

	function toggleDnf() {
		toggleDnfSolveDb(dbSolve);
	}

	async function handleDeleteSolve() {
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

	function toggleEditMode() {
		if (editMode) {
			updateSolve();
		}

		setEditMode(!editMode);
	}

	function handleDone() {
		dispatch(closeModal());
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
	const isSystemDnf = effSolve.dnf && effSolve.raw_time === 0;

	const time = getTimeString(effSolve.time);
	const baseCubeTypeInfo = getCubeTypeInfoById(cubeType);
	const bucketLabel = getCubeTypeBucketLabelWithCategory(cubeType, solve.scramble_subset);
	const cubeTypeInfo = baseCubeTypeInfo ? { ...baseCubeTypeInfo, name: bucketLabel || baseCubeTypeInfo.name } : baseCubeTypeInfo;

	const layoutProps: SolveLayoutProps = {
		solve,
		dbSolve,
		effSolve,
		user,
		disabled: !!disabled,
		editMode,
		mobileMode,
		toggleEditMode,
		togglePlusTwo,
		toggleDnf,
		deleteSolve: handleDeleteSolve,
		handleChange,
		handleDone,
		onComplete,
		time,
		cubeTypeInfo,
		endedAt,
		isSystemDnf,
		plusTwo: !!plusTwo,
		dnf: !!dnf,
		smartDevice,
	};

	if (isSmartCube) {
		return <SmartSolveLayout {...layoutProps} />;
	}

	return <NormalSolveLayout {...layoutProps} />;
}
