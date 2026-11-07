import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Fire } from 'phosphor-react';
import { useWarmup } from '../../../lib/warmup/store';
import block from '../../../styles/bem';
import { saveLastWarmupSolve, undoWarmupAutoSave, warmupSolveBeatsPb } from '../helpers/warmup';
import './WarmupStatus.scss';

const b = block('warmup-status');

/**
 * Takes the diff's place under the digits while warm-up mode is on (SolveDiff.tsx): the saved
 * solves' difference says nothing about a time that is not saved, and this slot already exists in
 * every timer layout. A DNF cannot be saved: nobody wants one back.
 *
 * Warm-up has no PB celebration, so a record would be easy to miss and gone with the next solve.
 * The Save button says so instead: an accent fill and "PB". With auto-save on (setting
 * `warmup_auto_save`: PBs, or PBs and times under the user's threshold) such a solve is saved by
 * itself and the chip offers Undo until the next solve: a timer stopped by accident gives a fast
 * time that would otherwise stay as a fake PB.
 */
export default function WarmupStatus() {
	const { t } = useTranslation();
	const { count, last, saved, autoSaved } = useWarmup();
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
			{saved && (
				<span className={b('saved')}>
					<Check weight="bold" />
					{t(autoSaved === 'pb' ? 'warmup.auto_saved_pb' : 'warmup.saved')}
				</span>
			)}
			{saved && autoSaved && (
				<button
					type="button"
					className={b('save')}
					title={t('warmup.undo_title')}
					onClick={undoWarmupAutoSave}
				>
					{t('warmup.undo')}
				</button>
			)}
		</div>
	);
}
