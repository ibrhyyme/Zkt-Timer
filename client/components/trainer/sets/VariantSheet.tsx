/**
 * VariantSheet: pick the algorithm a set row carries for its case (trainer-sets 5.4).
 *
 * The list is the library main algorithm, the library alternatives and the shared pool
 * (TrainerAlternative). Guest alternatives on this device are left out: the server only accepts
 * library and pool texts (4.3), so offering them would only end in a refusal. Each line shows
 * the text and its move count; the pattern is not repeated per line.
 *
 * The choice is written to this set only (`onPick` → updateAlgSetItem); the device's library
 * copy is not touched, the normal trainer keeps its own algorithm.
 *
 * The set picker's variant window (sets/picker) uses this sheet too, so the set page and the
 * picker list the same variants.
 */
import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Check, CircleNotch} from 'phosphor-react';
import block from '../../../styles/bem';
import {gqlQueryTyped} from '../../api';
import {TrainerAlternativesDocument} from '../../../@types/generated/graphql';
import {fetchLibraryCategory} from '../hooks/useAlgorithmData';
import {countMovesETM, ensureCubingReady} from '../../../util/trainer/algorithm_engine';
import {trainerAlgText} from '../../../util/trainer/set_queue';
import {getGqlErrorMessage} from '../../../util/gql-error';
import {findLibraryCase, mergeCaseAlternatives} from '../../../util/trainer/case_alternatives';

const b = block('alg-sets');

/**
 * Library main + library alternatives + pool, deduplicated by the trainer's own text
 * (client/util/trainer/case_alternatives.ts, the rule the stats panel picker uses too).
 * Guest alternatives are left out: the server only accepts library and pool texts (4.3).
 */
export async function loadCaseVariants(category: string, caseName: string, withPool: boolean): Promise<string[]> {
	const categoryData = await fetchLibraryCategory(category);
	const found = findLibraryCase({[category]: categoryData}, category, caseName);
	let pool: string[] = [];
	if (withPool) {
		try {
			const res = await gqlQueryTyped(TrainerAlternativesDocument, {category, caseName});
			pool = (res?.data?.trainerAlternatives || []).map((alt) => alt?.original_input || alt?.algorithm || '');
		} catch {
			// the library variants are enough without the pool
		}
	}
	return mergeCaseAlternatives({
		primary: found?.entry.algorithm,
		library: found?.entry.alternatives || [],
		pool,
	});
}

interface Props {
	category: string;
	caseName: string;
	current: string;
	signedIn: boolean;
	onPick: (algorithm: string) => Promise<void>;
	onClose?: () => void;
}

export default function VariantSheet({category, caseName, current, signedIn, onPick, onClose}: Props) {
	const {t} = useTranslation();
	const [variants, setVariants] = useState<string[] | null>(null);
	const [cubingReady, setCubingReady] = useState(false);
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState('');

	useEffect(() => {
		let alive = true;
		loadCaseVariants(category, caseName, signedIn).then(
			(list) => alive && setVariants(list),
			() => alive && setVariants([])
		);
		ensureCubingReady().then(
			() => alive && setCubingReady(true),
			() => {}
		);
		return () => {
			alive = false;
		};
	}, [category, caseName, signedIn]);

	const currentKey = trainerAlgText(current);
	// The row's own text stays pickable even when the library no longer lists it.
	const list = variants ? (variants.some((v) => trainerAlgText(v) === currentKey) ? variants : [current, ...variants]) : null;

	async function pick(alg: string) {
		if (busy || trainerAlgText(alg) === currentKey) {
			if (!busy && onClose) onClose();
			return;
		}
		setBusy(alg);
		setError('');
		try {
			await onPick(alg);
			if (onClose) onClose();
		} catch (err) {
			setError(getGqlErrorMessage(err, t, 'trainer.sets.load_error'));
			setBusy(null);
		}
	}

	return (
		<div className={b('sheet')}>
			{!list ? (
				<p className={b('sheet-message')}>
					<CircleNotch className="spin" size={18} aria-hidden="true" /> {t('trainer.sets.loading')}
				</p>
			) : (
				<div className={b('variants')} role="listbox" aria-label={t('trainer.sets.variant_title')}>
					{list.map((alg) => {
						const selected = trainerAlgText(alg) === currentKey;
						const moves = cubingReady ? countMovesETM(trainerAlgText(alg)) : 0;
						return (
							<button
								key={alg}
								type="button"
								role="option"
								aria-selected={selected}
								className={b('variant', {selected})}
								disabled={!!busy}
								onClick={() => pick(alg)}
							>
								<code className={b('variant-alg')}>{alg}</code>
								<span className={b('variant-meta')}>
									{moves > 0 ? t('trainer.sets.variant_moves', {count: moves}) : null}
									{busy === alg ? <CircleNotch className="spin" size={16} aria-hidden="true" /> : null}
									{selected ? <Check size={16} weight="bold" aria-hidden="true" /> : null}
								</span>
							</button>
						);
					})}
				</div>
			)}
			{error ? (
				<p className={b('note', {error: true})} role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}
