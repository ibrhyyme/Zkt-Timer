import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Fire } from 'phosphor-react';
import { useWarmup } from '../../../lib/warmup/store';
import block from '../../../styles/bem';
import { saveLastWarmupSolve, warmupSolveBeatsPb } from '../helpers/warmup';
import './WarmupStatus.scss';

const b = block('warmup-status');

/**
 * Takes the diff's place under the digits while warm-up mode is on (SolveDiff.tsx): the saved
 * solves' difference says nothing about a time that is not saved, and this slot already exists in
 * every timer layout. A DNF cannot be saved: nobody wants one back.
 *
 * Warm-up has no PB celebration, so a record would be easy to miss and gone with the next solve.
 * The Save button says so instead: an accent fill and "PB".
 */
export default function WarmupStatus() {
	const { t } = useTranslation();
	const { count, last, lastSaved } = useWarmup();
	const isPb = useMemo(() => !!last && warmupSolveBeatsPb(last), [last]);

	return (
		<div className={b()}>
			<span className={b('info')}>
				<Fire weight="fill" className={b('icon')} />
				<span>{t('warmup.label')}</span>
				{count > 0 && (
					<>
						<span aria-hidden="true">·</span>
						<span className={b('count')}>{count}</span>
					</>
				)}
			</span>
			{last && !last.dnf && (
				<button
					type="button"
					className={b('save', { pb: isPb })}
					title={t(isPb ? 'warmup.save_pb_title' : 'warmup.save_title')}
					onClick={saveLastWarmupSolve}
				>
					{isPb && <span className={b('pb')}>PB </span>}
					{t('warmup.save')}
				</button>
			)}
			{lastSaved && (
				<span className={b('saved')}>
					<Check weight="bold" />
					{t('warmup.saved')}
				</span>
			)}
		</div>
	);
}
