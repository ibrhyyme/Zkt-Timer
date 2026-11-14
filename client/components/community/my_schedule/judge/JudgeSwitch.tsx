import React from 'react';
import {useTranslation} from 'react-i18next';
import {Check} from 'phosphor-react';
import block from '../../../../styles/bem';
import {OutboxSnapshot} from '../../../../util/judge-outbox';
import {JudgeCard as JudgeCardData} from '../../../../../shared/zkt_judge';
import {buildRows, cardProgress} from './judge-rows';

const b = block('judge');

interface Props {
	cards: JudgeCardData[];
	activeId: string;
	outbox: OutboxSnapshot;
	userId: string;
	onSwitch: (cardId: string) => void;
}

/**
 * One judge, two competitors when judges run short (owner, 2026-11-14): the
 * cards in hand side by side over the open card, one tap apart. The station
 * number leads because the judge reads the station sign at the table, not the
 * name.
 */
export default function JudgeSwitch({cards, activeId, outbox, userId, onSwitch}: Props) {
	const {t} = useTranslation();

	return (
		<div className={b('switch')} role="tablist" aria-label={t('zkt_comp.judge_other_cards')}>
			{cards.map((c) => {
				const active = c.cardId === activeId;
				const {written, total} = cardProgress(buildRows(c, outbox, userId));
				const done = c.noShow || written >= total;
				return (
					<button
						key={c.cardId}
						type="button"
						role="tab"
						aria-selected={active}
						className={b('switch-item', {active})}
						// The keyboard stays up: focus moves straight to the other card's line.
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => !active && onSwitch(c.cardId)}
					>
						<span className={b('switch-top')}>
							<span className={b('switch-station')}>
								<span className={b('switch-label')}>{t('zkt_comp.judge_station')}</span>
								<span className={b('switch-number')}>{c.station ?? '-'}</span>
							</span>
							<span className={b('switch-progress')}>
								{c.noShow ? (
									t('zkt_comp.judge_no_show')
								) : done ? (
									<Check size={16} weight="bold" aria-label={`${written}/${total}`} />
								) : (
									`${written}/${total}`
								)}
							</span>
						</span>
						<span className={b('switch-name')}>{c.competitor.name}</span>
					</button>
				);
			})}
		</div>
	);
}
