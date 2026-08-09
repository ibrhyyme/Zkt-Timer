import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {X} from 'phosphor-react';
import {fetchSolves} from '../../db/solves/query';
import {getTimeString} from '../../util/time';
import {getCubeTypeBucketLabel} from '../../util/cubes/util';
import {getFullFormattedDate} from '../../util/dates';
import block from '../../styles/bem';
import './SolvePicker.scss';

const b = block('solve-picker');

const RECENT_LIMIT = 40;

interface Props {
	onPick: (solveId: string) => void;
	onClose: () => void;
}

/**
 * Recent solves, read straight from the local database.
 *
 * No server round trip: the timer already keeps every solve in LokiJS, so the list
 * the user is choosing from is the same one they see on their own solve list.
 */
export default function SolvePicker({onPick, onClose}: Props) {
	const {t} = useTranslation();
	const [query, setQuery] = useState('');

	const solves = useMemo(() => fetchSolves({}, {limit: RECENT_LIMIT}), []);

	const filtered = useMemo(() => {
		const term = query.trim().toLowerCase();
		if (!term) return solves;

		return solves.filter((solve: any) => {
			const label = getCubeTypeBucketLabel(solve.cube_type, solve.scramble_subset) || '';
			return (
				label.toLowerCase().includes(term) ||
				getTimeString(solve.time).includes(term)
			);
		});
	}, [solves, query]);

	return (
		<div className={b()}>
			<div className={b('head')}>
				<span className={b('title')}>{t('messages.pick_solve')}</span>
				<button type="button" className={b('close')} onClick={onClose} aria-label={t('messages.close')}>
					<X weight="bold" />
				</button>
			</div>

			<input
				autoFocus
				className={b('search')}
				value={query}
				placeholder={t('messages.filter_solves')}
				onChange={(e) => setQuery(e.target.value)}
			/>

			<div className={b('list')}>
				{filtered.length === 0 ? (
					<p className={b('empty')}>{t('messages.no_solves')}</p>
				) : (
					filtered.map((solve: any) => (
						<button key={solve.id} type="button" className={b('row')} onClick={() => onPick(solve.id)}>
							<span className={b('time')}>
								{solve.dnf ? 'DNF' : getTimeString(solve.time)}
							</span>
							<span className={b('meta')}>
								{getCubeTypeBucketLabel(solve.cube_type, solve.scramble_subset) || solve.cube_type}
							</span>
							<span className={b('date')}>{getFullFormattedDate(solve.ended_at || solve.created_at)}</span>
						</button>
					))
				)}
			</div>
		</div>
	);
}
