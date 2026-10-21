import {ElementType} from 'react';
import {
	ArrowFatLineDown,
	BellRinging,
	ChartBar,
	CloudArrowUp,
	Crown,
	FilePdf,
	FrameCorners,
	Lightning,
	Magnet,
	Medal,
	MusicNote,
	PaintBrush,
	ShareNetwork,
	Sliders,
	Trophy,
	Users,
} from 'phosphor-react';

/**
 * Single source of truth for "what is actually Pro".
 *
 * The Pro page (`pro_page/ProPage.tsx`) and the plan comparison modal
 * (`pro_page/PlanCompareModal.tsx`) both render from this list. They used to keep
 * two hand-maintained arrays, which drifted: the page advertised features that no
 * gate implemented (data import, PLL/Cross trainer, early access) while leaving out
 * ones that were genuinely gated (leaderboard publishing, slam to stop).
 *
 * A feature belongs here only while the gate named in its comment exists in code.
 * Delete the gate, delete the entry. That turns the next audit into a diff of this
 * file against the gates instead of a manual trace through the whole app.
 *
 * `key` is the i18n key (`pro_page.features.<key>.title` / `.desc`) AND the
 * `featureKey` the upsell modal takes (`pro.modal.<key>.*`, see ProOnlyModal).
 * One name for all three on purpose: the record-alert upsell was called
 * `competition_watch` on the modal side and `record_alerts` on the page, and
 * nothing tied the two together.
 */
/**
 * Where a feature sits on the Pro page. Order here is the order the groups are shown;
 * the i18n label is `pro_page.groups.<group>`.
 */
export const PRO_FEATURE_GROUPS = ['analysis', 'practice', 'community', 'personal'] as const;
export type ProFeatureGroup = (typeof PRO_FEATURE_GROUPS)[number];

export interface ProFeature {
	/** Stable identity. Also the i18n key suffix and the ProOnlyModal featureKey. */
	key: string;
	/** Icon rendered next to the feature on the Pro page. */
	icon: ElementType;
	/** `pro_page.features.<key>.title` */
	titleKey: string;
	/** `pro_page.features.<key>.desc` */
	descKey: string;
	/** Pro page section. */
	group: ProFeatureGroup;
}

function feature(key: string, icon: ElementType, group: ProFeatureGroup): ProFeature {
	return {
		key,
		icon,
		group,
		titleKey: `pro_page.features.${key}.title`,
		descKey: `pro_page.features.${key}.desc`,
	};
}

export const PRO_FEATURES: readonly ProFeature[] = [
	// Gate: server Solve.resolver.ts `solves` / `solvesByIds` @Authorized([LOGGED_IN, PRO]),
	// client sync-gate.ts canReadSync(). WRITE stays open to every logged-in user, only
	// READ is Pro, so this line sells history and cross-device restore, nothing else.
	feature('sync', CloudArrowUp, 'analysis'),
	// Gate: client SmartSolveLayout `showProOverlay` (plus PhaseAnalysis, PhaseSplits,
	// SessionStepsTable, ReplayPlayer), server CaseStats.resolver.ts @Authorized([LOGGED_IN, PRO]).
	feature('smart_cube_analysis', ChartBar, 'analysis'),
	// Gate: client hub/StudyModeSwitch (Smart side opens this modal) and TrainingArea `useSmartCube`.
	feature('trainer_smart_cube', Lightning, 'practice'),
	// Gate: client AlgorithmSelector `handlePdfExport` -> openProOnlyModal('trainer_pdf').
	feature('trainer_pdf', FilePdf, 'practice'),
	// Gate: client ThemeOption `locked`, driven by `proOnly: true` on six themes in
	// util/themes/theme_consts.ts.
	feature('themes', PaintBrush, 'personal'),
	// Gate: client TimerBackground `userIsPro`.
	feature('timer_background', FrameCorners, 'personal'),
	// Gate: client ExtrasTab `slamProGated` (upsell) and useSlamToStop `proAllowed`
	// (checked at arm time, so an expired subscription stops arming the detector).
	feature('slam_to_stop', ArrowFatLineDown, 'practice'),
	// Gate: client canUseMagnetStart (lib/magnet-start-access.ts), read at consumption by
	// useMagnetStart (arming the detector) and useMagnetReversed (turning the screen), and
	// ExtrasTab `magnetProGated` (upsell row).
	feature('magnet_start', Magnet, 'practice'),
	// Gate: client FriendlyRoom music button -> openProOnlyModal('room_music'),
	// server YouTubeSearch.resolver.ts @Authorized([Role.PRO]).
	feature('room_music', MusicNote, 'community'),
	// Gate: client only. PRO_GATED_TIMER_TYPES in timer/helpers/pro_timer_types.ts,
	// applied by TimerTypeGrid / TimerTypePicker (`requireProForSmart`) and by
	// FriendlyRoom, which downgrades an already-selected gated type back to keyboard.
	// The room solve socket payload carries no timer type, so the server cannot
	// verify this one today.
	feature('room_smart_cube', Users, 'community'),
	// Gate: server CompetitionFollow.resolver.ts `followCompetitor`
	// @Authorized([LOGGED_IN, PRO]), client FollowBellButton.
	feature('competition_follow', BellRinging, 'community'),
	// Gate: server RecordWatch.resolver.ts `saveRecordWatch` @Authorized([LOGGED_IN, PRO]),
	// client RecordRadar -> openProOnlyModal('record_alerts').
	feature('record_alerts', Trophy, 'community'),
	// Gate: server Leaderboards.resolver.ts `publishTopSolve` / `publishTopAverages`
	// @Authorized([LOGGED_IN, PRO]), client PublishSolves renders ProOnlyModal instead.
	feature('leaderboard_publish', Medal, 'community'),
	// Gate: client AvatarImage `showProRing`. Cosmetic, but it reads is_pro off the
	// server-issued account, so a local flag flip cannot fake it.
	feature('pro_badge', Crown, 'personal'),
	// Gate: client CustomizeStatsEditor `<FormSection proOnly>` (FormSection.tsx).
	feature('stats_customization', Sliders, 'analysis'),
	// Gate: client NormalSolveLayout, share link rendered only when canReadSync().
	feature('solve_sharing', ShareNetwork, 'analysis'),
];

/** Convenience for tests and for anything that only needs the identities. */
export const PRO_FEATURE_KEYS: readonly string[] = PRO_FEATURES.map((f) => f.key);
