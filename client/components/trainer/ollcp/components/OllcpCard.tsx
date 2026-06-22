/**
 * OllcpCard — one OLLCP variant card (port of the standalone reference design):
 * full-color LL diagram + priority badge (Önce/Orta/Sonra) + the minimal relational checks.
 */
import React from 'react';
import block from '../../../../styles/bem';
import LLPatternView from '../../panels/LLPatternView';
import type {OllcpVariant, SimilarInfo} from '../types';

const b = block('trainer-ollcp');

interface Props {
	variant: OllcpVariant;
	/** Highlighted (e.g. revealed answer after a solve). */
	active?: boolean;
	/** Confusable sibling variants + how to tell them apart. */
	similar?: SimilarInfo[];
}

export default function OllcpCard({variant, active, similar}: Props) {
	return (
		<div className={b('card', {active: !!active})}>
			<div className={b('card-top')}>
				<div className={b('diagram')}>
					{/* Standard trainer OLLCP look with white-on-bottom (yellow last layer, how the user
					    solves): topFace='D' (yellow top), frontFace='F', stickering='OLLCP' → corners
					    coloured, edges grey (recognition-optimised; edges change with the EPLL). */}
					<LLPatternView pattern={variant.pattern} topFace="D" frontFace="F" stickering="OLLCP" size={104} />
				</div>
				<div className={b('card-meta')}>
					<span className={b('vlabel')}>{variant.n}</span>
					<span className={b('prio', {['t' + variant.prioTier]: true})}>
						{variant.prioLabel} · {variant.moves}h
					</span>
				</div>
			</div>
			<div className={b('alg')}>{variant.algorithm}</div>
			<div className={b('cue')}>
				{variant.checks.map((c, i) => (
					<span key={i} className={b('chk', {on: c.on})}>
						{c.text}
					</span>
				))}
			</div>
			{similar && similar.length > 0 && (
				<div className={b('similar')}>
					<b>⚠ Benzer:</b>{' '}
					{similar.map((s, i) => (
						<span key={s.n}>
							{i > 0 && ' · '}
							{s.n} <span className={b('similar-diff')}>(ayırt: {s.diff.join(' & ')})</span>
						</span>
					))}
				</div>
			)}
		</div>
	);
}
