/**
 * OllcpCard — one OLLCP variant card (port of the standalone reference design):
 * full-color LL diagram + priority badge (Önce/Orta/Sonra) + the minimal relational checks.
 */
import React from 'react';
import block from '../../../../styles/bem';
import LLPatternView from '../../panels/LLPatternView';
import type {OllcpVariant} from '../types';

const b = block('trainer-ollcp');

interface Props {
	variant: OllcpVariant;
	/** Highlighted (e.g. revealed answer after a solve). */
	active?: boolean;
}

export default function OllcpCard({variant, active}: Props) {
	return (
		<div className={b('card', {active: !!active})}>
			<div className={b('card-top')}>
				<div className={b('diagram')}>
					{/* 'full' → every sticker in real colour (oriented = yellow); shows the top corner +
					    edge colours so similarities across variants are visible (matches the reference). */}
					<LLPatternView pattern={variant.pattern} topFace="D" frontFace="F" stickering="full" size={104} />
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
		</div>
	);
}
