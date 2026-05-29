/**
 * GuideGroupCard — 9 grup karti (3-Bar, Double Lights, ...).
 */
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {Check, Lightning} from 'phosphor-react';
import Button, {CommonType} from '../../../common/button/Button';
import StickerPattern from './StickerPattern';
import {formatAccuracy} from '../../../../util/trainer/recognition/formatters';
import type {GuideGroup} from '../../../../util/trainer/recognition/guide_lookup';

const b = block('trainer-recognition');

interface GuideGroupCardProps {
	group: GuideGroup;
	defaultPatternColumns?: number;
	highlightRowIndex?: number;
	showPracticeButton?: boolean;
	mastered?: boolean;
	bestAccuracy?: number | null;
	onPractice?: () => void;
	practiceLabel?: string;
}

interface NormalSegment {
	type: 'normal';
	row: GuideGroup['rows'][number];
	originalIndex: number;
}

interface AnnotatedSegment {
	type: 'annotated';
	rows: (GuideGroup['rows'][number] & {originalIndex: number})[];
	annotation: {id: string; type: string; fromRow: number; toRow: number; text: string};
}

type Segment = NormalSegment | AnnotatedSegment;

export default function GuideGroupCard({
	group,
	defaultPatternColumns = 6,
	highlightRowIndex = -1,
	showPracticeButton = false,
	mastered = false,
	bestAccuracy = null,
	onPractice,
	practiceLabel = 'Practice',
}: GuideGroupCardProps) {
	const {t} = useTranslation();
	const masteredTitle = t('trainer.recognition.pb_mastered', {defaultValue: 'Mastered'});
	const segments = useMemo<Segment[]>(() => {
		const result: Segment[] = [];
		const annotationMap = new Map<string, AnnotatedSegment['annotation']>();
		for (const ann of group.annotations || []) {
			annotationMap.set(ann.id, ann);
		}

		let i = 0;
		const rows = group.rows;
		while (i < rows.length) {
			const row = rows[i];
			if (row.annotationRef) {
				const ann = annotationMap.get(row.annotationRef);
				const groupedRows: AnnotatedSegment['rows'] = [];
				while (i < rows.length && rows[i].annotationRef === row.annotationRef) {
					groupedRows.push({...rows[i], originalIndex: i});
					i++;
				}
				if (ann) result.push({type: 'annotated', rows: groupedRows, annotation: ann});
			} else {
				result.push({type: 'normal', row, originalIndex: i});
				i++;
			}
		}
		return result;
	}, [group]);

	return (
		<article className={b('guide-group')}>
			<div className={b('guide-group-header')}>
				<StickerPattern layers={group.header.layers} minColumns={defaultPatternColumns} />
				<h6 className={b('guide-group-title')}>{group.title}</h6>
				{mastered && (
					<span style={{marginLeft: 'auto', color: 'rgb(var(--success-color))'}} title={masteredTitle}>
						<Check weight="fill" />
					</span>
				)}
				{!mastered && bestAccuracy !== null && (
					<span style={{marginLeft: 'auto', fontSize: '0.78rem', opacity: 0.75}}>
						{formatAccuracy(bestAccuracy)}
					</span>
				)}
			</div>

			<div className={b('guide-group-body')}>
				{segments.map((seg, si) => {
					if (seg.type === 'normal') {
						const isHighlight = seg.originalIndex === highlightRowIndex;
						return (
							<div key={si} className={b('guide-case-row', {highlight: isHighlight})}>
								<StickerPattern layers={seg.row.pattern.layers} minColumns={defaultPatternColumns} />
								{seg.row.text && <span className={b('guide-case-text')}>{seg.row.text}</span>}
							</div>
						);
					}
					const anyHighlight = seg.rows.some((r) => r.originalIndex === highlightRowIndex);
					return (
						<div key={si} className={b('guide-annotated-group')}>
							<div className={b('guide-annotated-patterns')}>
								{seg.rows.map((r, ri) => (
									<div
										key={ri}
										className={
											r.originalIndex === highlightRowIndex
												? b('guide-case-row', {highlight: true})
												: b('guide-case-row')
										}
									>
										<StickerPattern layers={r.pattern.layers} minColumns={defaultPatternColumns} />
									</div>
								))}
							</div>
							<div className={b('guide-brace-container')}>
								<div className={b('guide-brace')} />
							</div>
							<span
								className={
									anyHighlight
										? `${b('guide-case-text')} ${b('guide-case-text-highlight')}`
										: b('guide-case-text')
								}
							>
								{seg.annotation.text}
							</span>
						</div>
					);
				})}

				{showPracticeButton && (
					<div style={{textAlign: 'center', marginTop: 8}}>
						<Button
							theme={CommonType.TRANSPARENT}
							small
							icon={<Lightning weight="fill" />}
							text={practiceLabel}
							className={b('btn-pill')}
							onClick={(e) => {
								e.stopPropagation();
								onPractice?.();
							}}
							noMargin
						/>
					</div>
				)}
			</div>
		</article>
	);
}
