/**
 * GlossaryView — terim sözlüğü.
 * 3 sekme: Colors / Patterns / Groups.
 */
import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {Info} from 'phosphor-react';
import StickerPattern from '../components/StickerPattern';
import {GLOSSARY_COLORS, GLOSSARY_PATTERNS} from '../../../../util/trainer/recognition/glossary_data';
import {getGuideData} from '../../../../util/trainer/recognition/guide_lookup';

const b = block('trainer-recognition');

type Tab = 'colors' | 'patterns' | 'groups';

export default function GlossaryView() {
	const {t} = useTranslation();
	const [tab, setTab] = useState<Tab>('colors');
	const guideData = getGuideData();

	const tabs: {key: Tab; label: string}[] = [
		{key: 'colors', label: t('trainer.recognition.glossary.tab_colors', {defaultValue: 'Colors'})},
		{key: 'patterns', label: t('trainer.recognition.glossary.tab_patterns', {defaultValue: 'Patterns'})},
		{key: 'groups', label: t('trainer.recognition.glossary.tab_groups', {defaultValue: 'Groups'})},
	];

	return (
		<div className={b('glossary')}>
			<h2 className={b('glossary-title')}>
				{t('trainer.recognition.glossary.title', {defaultValue: 'Terim Sözlüğü'})}
			</h2>

			<div className={b('glossary-tabs')}>
				{tabs.map((tb) => (
					<button
						key={tb.key}
						type="button"
						className={b('glossary-tab', {active: tab === tb.key})}
						onClick={() => setTab(tb.key)}
					>
						{tb.label}
					</button>
				))}
			</div>

			<div className={b('glossary-content')}>
				{tab === 'colors' && (
					<>
						<div className={b('help-box')}>
							<Info weight="fill" className={b('help-box-icon')} />
							<div className={b('help-box-body')}>
								{t('trainer.recognition.glossary.colors_note', {
									defaultValue:
										'Bu renkler küpteki gerçek renk değil — rolüne göre etikettir. Yanından bakılan iki yüze göre değişir.',
								})}
							</div>
						</div>
						<div className={b('glossary-grid')}>
							{GLOSSARY_COLORS.map((c) => (
								<div key={c.id} className={b('glossary-card')}>
									<div className={b('glossary-card-visual')}>
										<StickerPattern layers={[{row: 0, col: 0, cells: [c.cellCode]}]} cellSize={48} minColumns={1} />
									</div>
									<div className={b('glossary-card-body')}>
										<div className={b('glossary-card-term')}>
											{t(`trainer.recognition.glossary.colors_${c.id}_term`, {defaultValue: c.id.toUpperCase()})}
										</div>
										<div className={b('glossary-card-desc')}>
											{t(`trainer.recognition.glossary.colors_${c.id}_desc`, {defaultValue: ''})}
										</div>
									</div>
								</div>
							))}
						</div>
					</>
				)}

				{tab === 'patterns' && (
					<div className={b('glossary-grid')}>
						{GLOSSARY_PATTERNS.map((p) => (
							<div key={p.id} className={b('glossary-card')}>
								{p.exampleCells && (
									<div className={b('glossary-card-visual')}>
										<StickerPattern layers={[{row: 0, col: 0, cells: p.exampleCells}]} cellSize={20} minColumns={6} />
									</div>
								)}
								<div className={b('glossary-card-body')}>
									<div className={b('glossary-card-term')}>{p.term}</div>
									<div className={b('glossary-card-desc')}>
										{t(`trainer.recognition.glossary.patterns_${p.id}_desc`, {defaultValue: ''})}
									</div>
								</div>
							</div>
						))}
					</div>
				)}

				{tab === 'groups' && (
					<div className={b('glossary-groups')}>
						{guideData.groups.map((g) => (
							<div key={g.id} className={b('glossary-group-card')}>
								<div className={b('glossary-group-header')}>
									<StickerPattern layers={g.header.layers} minColumns={6} />
									<h3 className={b('glossary-group-title')}>{g.title}</h3>
								</div>
								<p className={b('glossary-group-desc')}>
									{t(`trainer.recognition.glossary.groups_${g.id}_desc`, {defaultValue: ''})}
								</p>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
