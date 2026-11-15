import React from 'react';
import {useTranslation} from 'react-i18next';
import {Check} from 'phosphor-react';
import block from '../../../../styles/bem';
import {OutboxSnapshot} from '../../../../util/judge-outbox';
import {JudgeCard as JudgeCardData} from '../../../../../shared/zkt_judge';
import {buildRows, cardProgress, isEditable} from './judge-rows';

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
 * name. Lower station on the left (owner, 2026-11-15): stations are numbered
 * from the left at the table, so station 9 sits left of station 10 there too.
 * Inside a segment the station is a block on the left and the name takes the
 * rest in up to two lines (owner's pick B, 2026-11-15): cut to one line,
 * "Abdurrahman Ene…" did not tell the judge whose card it was.
 */
export default function JudgeSwitch({cards, activeId, outbox, userId, onSwitch}: Props) {
	const {t} = useTranslation();
	const ordered = [...cards].sort((x, y) => (x.station ?? Infinity) - (y.station ?? Infinity));

	return (
		<div className={b('switch')} role="tablist" aria-label={t('zkt_comp.judge_other_cards')}>
			{ordered.map((c) => {
				const active = c.cardId === activeId;
				const rows = buildRows(c, outbox, userId);
				const {written, total} = cardProgress(rows);
				const done = c.noShow || written >= total;
				// An approved extra or correction waiting on the card behind (Bursa,
				// 2026-11-15: the extra opened on the hidden card, the judge kept looking
				// at the other one's attempt 5 and asked three times).
				const opened = active ? null : (rows.find((r) => r.permit && isEditable(r))?.permit ?? null);
				return (
					<button
						key={c.cardId}
						type="button"
						role="tab"
						aria-selected={active}
						className={b('switch-item', {active, alert: !!opened})}
						// The keyboard stays up: focus moves straight to the other card's line.
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => !active && onSwitch(c.cardId)}
					>
						<span className={b('switch-station')}>
							<span className={b('switch-label')}>{t('zkt_comp.judge_station_short')}</span>
							<span className={b('switch-number')}>{c.station ?? '-'}</span>
						</span>
						<span className={b('switch-body')}>
							<span className={b('switch-name')}>{c.competitor.name}</span>
							<span className={b('switch-progress', {alert: !!opened})}>
								{opened ? (
									t(opened === 'EXTRA' ? 'zkt_comp.judge_switch_extra_open' : 'zkt_comp.judge_switch_correct_open')
								) : c.noShow ? (
									t('zkt_comp.judge_no_show')
								) : done ? (
									<Check size={16} weight="bold" aria-label={`${written}/${total}`} />
								) : (
									`${written}/${total}`
								)}
							</span>
						</span>
					</button>
				);
			})}
		</div>
	);
}
