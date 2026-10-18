import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './SplitSession.scss';
import block from '../../../styles/bem';
import { IModalProps } from '../../common/modal/Modal';
import Checkbox from '../../common/checkbox/Checkbox';
import Input from '../../common/inputs/input/Input';
import Button from '../../common/button/Button';
import { Session } from '../../../../server/schemas/Session.schema';
import { fetchSolves } from '../../../db/solves/query';
import { splitSessionDb } from '../../../db/sessions/update';
import {
	getBucketShortLabel,
	getCubeTypeBucketLabel,
	getCubeTypeInfoById,
	getSubsetLabel,
	groupBucketsByCubeType,
} from '../../../util/cubes/util';
import { formatInteger } from '../../../util/locale_format';
import {
	buildSplitSessionName,
	MAX_SPLIT_SESSION_NAME_LENGTH,
	SolveBucket,
	splitBucketKey,
} from '../../../../shared/session_split';

const b = block('split-session');

interface Props extends IModalProps {
	session: Session;
}

interface BucketRow {
	key: string;
	bucket: SolveBucket;
	label: string;
	count: number;
}

interface BucketGroup {
	cubeType: string;
	name: string;
	rows: BucketRow[];
}

/**
 * "Split session" (2.7-b): the user ticks cube types (and subsets such as PLL) and their
 * solves move into a new session named after this one. Removing one type from a session
 * is the same flow followed by deleting the new session (K-6).
 */
export default function SplitSession(props: Props) {
	const { session, onComplete } = props;
	const { t, i18n } = useTranslation();

	const groups = useMemo<BucketGroup[]>(() => {
		const counts = new Map<string, number>();
		const buckets: SolveBucket[] = [];
		for (const solve of fetchSolves({ session_id: session.id })) {
			const bucket = { cube_type: solve.cube_type, scramble_subset: solve.scramble_subset ?? null };
			const key = splitBucketKey(bucket);
			if (!counts.has(key)) {
				buckets.push({ cube_type: bucket.cube_type, scramble_subset: bucket.scramble_subset || null });
			}
			counts.set(key, (counts.get(key) || 0) + 1);
		}

		return groupBucketsByCubeType(buckets).map((group) => {
			const rows = group.subsets.map((subset) => {
				const bucket = { cube_type: group.cube_type, scramble_subset: subset };
				const key = splitBucketKey(bucket);
				return {
					key,
					bucket,
					label: getSubsetLabel(group.cube_type, subset) || subset || group.cubeTypeName,
					count: counts.get(key) || 0,
				};
			});
			return {
				cubeType: group.cube_type,
				name: getCubeTypeInfoById(group.cube_type)?.name || group.cubeTypeName || group.cube_type,
				rows,
			};
		});
	}, [session.id]);

	const allRows = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [customName, setCustomName] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const selectedRows = allRows.filter((row) => selected.has(row.key));
	const movedCount = selectedRows.reduce((sum, row) => sum + row.count, 0);
	const allSelected = selectedRows.length > 0 && selectedRows.length === allRows.length;

	const suggestedName = buildSplitSessionName(
		session.name,
		selectedRows.map((row) => getBucketShortLabel(row.bucket.cube_type, row.bucket.scramble_subset)),
		MAX_SPLIT_SESSION_NAME_LENGTH
	);
	const name = customName ?? (selectedRows.length ? suggestedName : '');

	function toggleRows(keys: string[], on: boolean) {
		setSelected((prev) => {
			const next = new Set(prev);
			for (const key of keys) {
				if (on) next.add(key);
				else next.delete(key);
			}
			return next;
		});
	}

	function countText(count: number) {
		return t('sessions.solve_count', { count, countText: formatInteger(count, i18n.language) });
	}

	async function split() {
		if (loading || !selectedRows.length || allSelected || !name.trim()) {
			return;
		}

		setLoading(true);
		try {
			const created = await splitSessionDb(
				session,
				selectedRows.map((row) => row.bucket),
				name
			);
			if (!created) {
				// Refused (no connection, server error): confirmOnServer has already told the user
				setLoading(false);
				return;
			}
			onComplete?.({ session: created, moved: movedCount });
		} catch (e) {
			console.error('splitSessionDb failed', e);
			setLoading(false);
		}
	}

	const disabled = loading || !selectedRows.length || allSelected || !name.trim();

	return (
		<div className={b()}>
			<div className={b('groups')}>
				{groups.map((group) => {
					const keys = group.rows.map((row) => row.key);
					const groupChecked = keys.every((key) => selected.has(key));
					const groupCount = group.rows.reduce((sum, row) => sum + row.count, 0);
					const single = group.rows.length === 1;

					return (
						<div key={group.cubeType} className={b('group')}>
							<div className={b('row', { head: !single })}>
								<Checkbox
									noMargin
									text={single ? getCubeTypeBucketLabel(group.cubeType, group.rows[0].bucket.scramble_subset) : group.name}
									checked={groupChecked}
									onChange={(e) => toggleRows(keys, e.target.checked)}
								/>
								<span className={b('count')}>{countText(groupCount)}</span>
							</div>
							{!single &&
								group.rows.map((row) => (
									<div key={row.key} className={b('row', { child: true })}>
										<Checkbox
											noMargin
											text={row.label}
											checked={selected.has(row.key)}
											onChange={(e) => toggleRows([row.key], e.target.checked)}
										/>
										<span className={b('count')}>{countText(row.count)}</span>
									</div>
								))}
						</div>
					);
				})}
			</div>

			{allSelected && <p className={b('note')}>{t('sessions.split_keep_one')}</p>}

			<Input
				noMargin
				maxLength={MAX_SPLIT_SESSION_NAME_LENGTH}
				legend={t('sessions.split_new_name')}
				placeholder={t('sessions.session_name_placeholder')}
				value={name}
				onChange={(e) => setCustomName(e.target.value)}
			/>

			<div className={b('actions')}>
				<Button
					glow
					primary
					large
					fullWidth
					text={
						movedCount
							? t('sessions.split_move_button', {
									count: movedCount,
									countText: formatInteger(movedCount, i18n.language),
							  })
							: t('sessions.split_session')
					}
					onClick={split}
					disabled={disabled}
					loading={loading}
				/>
			</div>
		</div>
	);
}
