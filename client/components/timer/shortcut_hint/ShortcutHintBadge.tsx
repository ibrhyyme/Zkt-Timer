import React from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../styles/bem';
import {useCubePalette} from '../../../util/cube_colors/useCubePalette';
import {NXN_FACES} from '../../../util/cube_colors/palette';
import ProTag from '../../common/pro_tag/ProTag';
import {ShortcutFinding} from '../../../lib/shortcut_hint/pick';
import {useGeneral} from '../../../util/hooks/useGeneral';
import './ShortcutHintBadge.scss';

const b = block('shortcut-hint');

interface Props {
	finding: ShortcutFinding;
	/** Punch id (shortcut_hint.punch.<id>), picked once when the badge is made; null: none. */
	punch: string | null;
	/** Pro (or Pro switched off): the moves are shown. Basic: a Pro tag in their place. */
	full: boolean;
}

/**
 * The "there was a shortcut" card shown in the timer notification slot after a solve
 * (lib/shortcut_hint/run.tsx). Read-only like the PB badge: the slot has pointer-events off.
 */
export default function ShortcutHintBadge({finding, punch, full}: Props) {
	const {t, i18n} = useTranslation();
	const palette = useCubePalette();

	const faceIndex = NXN_FACES.indexOf(finding.face as (typeof NXN_FACES)[number]);
	const swatch = faceIndex === -1 ? null : palette.nxn[faceIndex];

	// On a phone the slot is an overlay at the top of the time area, so the card keeps to
	// the PB tag's one line: the short fact and the moves. The punch is left to the voice
	// there; a taller card covered half the time on a short phone (owner, 2026-11-12).
	const compact = !!useGeneral('mobile_mode');
	const vars = {n: finding.moveCount, step: t(`shortcut_hint.step.${finding.step}`)};

	let line: string;
	if (compact) {
		line = t('shortcut_hint.fact_short', vars);
	} else {
		const fact = t('shortcut_hint.fact', vars);
		// Chinese runs sentences together without a space.
		const sep = (i18n.language || '').startsWith('zh') ? '' : ' ';
		line = punch ? `${fact}${sep}${t(`shortcut_hint.punch.${punch}`)}` : fact;
	}

	return (
		<p className={b({pro: full, compact})} role="status">
			<span className={b('line')}>{line}</span>
			{full ? (
				<span className={b('moves')}>
					{swatch && <span className={b('swatch')} style={{background: swatch}} aria-hidden="true" />}
					<span>{finding.moves}</span>
				</span>
			) : (
				<span className={b('locked')}>
					<ProTag />
					{!compact && <span>{t('shortcut_hint.pro_shows_moves')}</span>}
				</span>
			)}
		</p>
	);
}
