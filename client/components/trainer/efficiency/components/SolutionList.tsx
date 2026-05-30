/**
 * SolutionList — reveal sonrasi optimal cozum + (opsiyonel) alternatif
 * face/orientation cozumleri. Notasyon + move count.
 */
import React from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {solutionToString} from '../../../../util/trainer/efficiency/format';
import type {SolverResult} from '../../../../util/cross-solver/types';

const b = block('trainer-efficiency');

interface Props {
	selected: SolverResult | null;
	alternatives: SolverResult[];
	/** 'primary' → sadece optimal (+ empty/skip durumlari); 'alternatives' → sadece diger
	 * cozumler. Mobilde 3D player optimal ile alternatifler arasina girdigi icin ayri render. */
	section?: 'primary' | 'alternatives';
}

export default function SolutionList({selected, alternatives, section = 'primary'}: Props) {
	const {t} = useTranslation();

	// Alternatifler: secili olani disla (skip/cozumsuzde bos)
	const others = selected && selected.solution.length > 0 ? alternatives.filter((r) => r.face !== selected.face) : [];

	// ── Alternatives section ──
	if (section === 'alternatives') {
		if (others.length === 0) return null;
		return (
			<div className={b('solutions')}>
				<div className={b('solution-alt-label')}>{t('trainer.efficiency.alternatives', {defaultValue: 'Other solutions'})}</div>
				{others.map((r) => (
					<div key={r.face} className={b('solution-row')}>
						<span className={b('solution-face')}>{r.face}</span>
						<span className={b('solution-alg')}>{solutionToString(r)}</span>
						<span className={b('solution-count')}>
							{t('trainer.efficiency.move_count', {count: r.moveCount, defaultValue: '{{count}} moves'})}
						</span>
					</div>
				))}
			</div>
		);
	}

	// ── Primary section (optimal + empty/skip) ──
	if (!selected) {
		return <div className={b('solution-empty')}>{t('trainer.efficiency.no_solution', {defaultValue: 'No solution found'})}</div>;
	}
	if (selected.solution.length === 0) {
		return <div className={b('solution-empty')}>{t('trainer.efficiency.skip', {defaultValue: 'Skip — already solved'})}</div>;
	}

	return (
		<div className={b('solutions')}>
			<div className={b('solution-row', {primary: true})}>
				<span className={b('solution-badge')}>{t('trainer.efficiency.optimal', {defaultValue: 'Optimal'})}</span>
				<span className={b('solution-alg')}>{solutionToString(selected)}</span>
				<span className={b('solution-count')}>
					{t('trainer.efficiency.move_count', {count: selected.moveCount, defaultValue: '{{count}} moves'})}
				</span>
			</div>
		</div>
	);
}
