import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ArrowRight, Sparkle } from 'phosphor-react';
import './FeatureTip.scss';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import { CloseButton } from '../../common/icon_button/IconButton';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { FEATURE_TIPS, FeatureTip as FeatureTipDef, pickFeatureTip } from '../../../lib/feature_tips/feature_tips';
import { firstSolveTime, isFeatureTipRelevant } from '../../../lib/feature_tips/relevance';
import {
	announcementShownThisLoad,
	countFeatureTipView,
	featureTipShownThisLoad,
	markFeatureTipSeen,
	noteFeatureTipShown,
	readFeatureTipPreview,
	readFeatureTipState,
} from '../../../lib/feature_tips/store';
import { useWarmup } from '../../../lib/warmup/store';
import PresetBackground from '../timer_background/presets/PresetBackground';
import { PRESET_BACKGROUND_IDS } from '../timer_background/presets/preset_shaders';

const b = block('feature-tip');

// Long enough for the page and any announcement window to settle first.
const SHOW_DELAY_MS = 4000;
// Unanswered, it leaves on its own and does not come back (FEATURE_TIP_MAX_VIEWS).
const VISIBLE_MS = 15000;
// The ready-made background preview moves on to the next scene this often.
const PREVIEW_STEP_MS = 2500;

interface Props {
	/** A solve or inspection is running, or the screen is not the plain timer. */
	blocked: boolean;
}

/** The ready-made backgrounds, one after another, live in the user's theme. */
function PresetBackgroundsVisual() {
	const [index, setIndex] = useState(0);
	useEffect(() => {
		const timer = setInterval(() => setIndex((i) => (i + 1) % PRESET_BACKGROUND_IDS.length), PREVIEW_STEP_MS);
		return () => clearInterval(timer);
	}, []);
	return <PresetBackground preset={PRESET_BACKGROUND_IDS[index]} moving paused={false} className={b('canvas')} />;
}

/**
 * The card that tells about a new feature (lib/feature_tips): a live picture of it, its
 * name, one sentence, and "Take a look", which opens the feature's page and nothing more.
 */
export default function FeatureTip({ blocked }: Props) {
	const { t } = useTranslation();
	const history = useHistory();
	const modals = useGeneral('modals');
	const [tip, setTip] = useState<FeatureTipDef | null>(null);
	const warmupActive = useWarmup().active;

	const blockedRef = useRef(blocked);
	blockedRef.current = blocked;
	const modalOpenRef = useRef(false);
	modalOpenRef.current = Array.isArray(modals) && modals.length > 0;

	useEffect(() => {
		const previewId = readFeatureTipPreview();
		const preview = previewId ? FEATURE_TIPS.find((t) => t.id === previewId) : null;
		if (featureTipShownThisLoad() && !preview) return undefined;
		const timer = setTimeout(() => {
			if (blockedRef.current || modalOpenRef.current) return;
			// A preview ignores every rule but the running solve and an open window.
			if (preview) {
				setTip(preview);
				return;
			}
			if (featureTipShownThisLoad() || announcementShownThisLoad()) return;
			const startedAt = firstSolveTime();
			if (startedAt === null) return;
			const next = pickFeatureTip(FEATURE_TIPS, readFeatureTipState(), Date.now(), isFeatureTipRelevant, startedAt);
			if (!next) return;
			noteFeatureTipShown();
			countFeatureTipView(next.id);
			setTip(next);
		}, SHOW_DELAY_MS);
		return () => clearTimeout(timer);
	}, []);

	useEffect(() => {
		if (!tip) return undefined;
		const timer = setTimeout(() => setTip(null), VISIBLE_MS);
		return () => clearTimeout(timer);
	}, [tip]);

	// A solve starting takes the screen back at once.
	useEffect(() => {
		if (blocked) setTip(null);
	}, [blocked]);

	// The warm-up card has done its job the moment the flame button is pressed.
	useEffect(() => {
		if (warmupActive && tip?.id === 'warmup_mode') setTip(null);
	}, [warmupActive, tip]);

	if (!tip) return null;

	function close() {
		markFeatureTipSeen(tip.id);
		setTip(null);
	}

	function look() {
		markFeatureTipSeen(tip.id);
		setTip(null);
		history.push(tip.to);
	}

	return (
		<div className={b({ visual: !!tip.visual, 'on-page': !tip.to })} role="status">
			{tip.visual === 'preset_backgrounds' && (
				<div className={b('visual')} aria-hidden="true">
					<PresetBackgroundsVisual />
				</div>
			)}
			<div className={b('body')}>
				<span className={b('tag')}>
					<Sparkle weight="fill" />
					{t('feature_tips.new')}
				</span>
				<strong className={b('title')}>{t(tip.titleKey)}</strong>
				<span className={b('text')}>{t(tip.textKey)}</span>
				{tip.to && (
					<div className={b('actions')}>
						<Button small primary text={t('feature_tips.look')} icon={<ArrowRight weight="bold" />} onClick={look} />
					</div>
				)}
			</div>
			<CloseButton size="sm" className={b('close')} onClick={close} />
		</div>
	);
}
