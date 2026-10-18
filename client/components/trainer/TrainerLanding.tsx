/**
 * TrainerLanding: the trainer's two card pages.
 *
 * - Hub (`/trainer`, view `landing`): two cards, Trainers and Algorithm Sets. Trainers opens the
 *   Trainers page, Algorithm Sets opens My Sets.
 * - Trainers page (`/trainer/modes`, view `modes`): Algorithm Trainer, PLL Recognition, Cross
 *   and XCross; admins also get the OLLCP card first.
 *
 * Desktop: card grid (LandingCard). Phone: full width coloured cards (CardStack); on the Trainers
 * page they overlap like cards in a wallet, every name stays visible and a tap opens the trainer.
 *
 * No card is a Pro card: the Algorithm Trainer card opens for everyone and Smart Cube mode is
 * locked on the study mode switch (hub/StudyModeSwitch), not here.
 */
import React from 'react';
import {useHistory} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import block from '../../styles/bem';
import './common/TrainerAccents.scss';
import './TrainerLanding.scss';
import {useTrainerContext} from './TrainerContext';
import {useMe} from '../../util/hooks/useMe';
import {useGeneral} from '../../util/hooks/useGeneral';
import {isProEnabled, isPro} from '../../lib/pro';
import {HUB_CARDS, TRAINER_MODES, OLLCP_MODE} from './landing_modes';
import type {TrainerEntryId} from './landing_modes';
import {resolveStudyMode, smartModeAllowed} from '../../util/trainer/study_mode';
import {MY_SETS_PATH} from '../../util/trainer/url/trainer_url';
import TrainerModeHeader from './common/TrainerModeHeader';
import LandingCard from './landing/LandingCard';
import CardStack from './landing/CardStack';
import type {CardView} from './landing/card_view';

const b = block('trainer');

export default function TrainerLanding() {
	const {t} = useTranslation();
	const history = useHistory();
	const {state, dispatch} = useTrainerContext();
	const me = useMe();
	const mobileMode = useGeneral('mobile_mode');
	const proGating = isProEnabled();
	const smartAllowed = smartModeAllowed(proGating, isPro(me || undefined));
	const onModes = state.view === 'modes';

	const openEntry = (entry: TrainerEntryId) => {
		// Signed-out visitors are not bounced to /login here. The trainer opens and states
		// what it needs (see TrainerContent), which tells them what they are missing.
		if (entry === 'algorithms') {
			// The study mode the user picked last time (synced), Standard when Smart is locked.
			dispatch({type: 'SET_MODE', payload: resolveStudyMode(null, state.options.lastMode, smartAllowed)});
			return;
		}
		dispatch({type: 'SET_MODE', payload: entry});
	};

	let cards: CardView[];
	if (onModes) {
		const modes = me?.admin ? [OLLCP_MODE, ...TRAINER_MODES] : TRAINER_MODES;
		cards = modes.map((mode) => {
			const group = mode.groups[0];
			return {
				id: mode.id,
				Icon: mode.Icon,
				accent: mode.accent,
				eyebrow: mode.admin ? t('trainer.landing_admin_badge') : null,
				title: t(mode.titleKey),
				desc: t(mode.descKey),
				groupLabel: group ? t(group.labelKey) : null,
				items: group
					? group.itemKeys.map((key) => ({text: t(key), pro: proGating && !!group.proItemKeys?.includes(key)}))
					: [],
				onSelect: () => openEntry(mode.id),
			};
		});
	} else {
		cards = HUB_CARDS.map((hub) => ({
			id: hub.id,
			Icon: hub.Icon,
			accent: hub.accent,
			title: t(hub.titleKey),
			desc: t(hub.descKey),
			groupLabel: t('trainer.hub.whats_inside'),
			// The Trainers card lists the trainers themselves, each with its own icon and colour.
			items:
				hub.id === 'trainers'
					? TRAINER_MODES.map((mode) => ({text: t(mode.titleKey), Icon: mode.Icon, accent: mode.accent}))
					: hub.itemKeys.map((key) => ({text: t(key)})),
			onSelect: () => {
				if (hub.id === 'trainers') dispatch({type: 'SET_VIEW', payload: 'modes'});
				else history.push(MY_SETS_PATH);
			},
		}));
	}

	const toHub = () => dispatch({type: 'SET_VIEW', payload: 'landing'});
	const header = onModes ? (
		<TrainerModeHeader
			onBack={toHub}
			trail={[{label: t('trainer.title'), onClick: toHub}, {label: t('trainer.hub.trainers_title')}]}
		/>
	) : null;

	if (mobileMode) {
		return (
			<>
				{header}
				<div className={b('landing', {stack: true})}>
					<CardStack cards={cards} overlap={onModes} />
				</div>
			</>
		);
	}

	return (
		<>
			{header}
			<div className={b('landing', {hub: !onModes})}>
				<div className={b('landing-header')}>
					<h1 className={b('landing-title')}>{onModes ? t('trainer.hub.trainers_title') : t('trainer.title')}</h1>
					<p className={b('landing-subtitle')}>{onModes ? t('trainer.landing_subtitle') : t('trainer.hub.hub_subtitle')}</p>
				</div>
				<div className={b('landing-cards')}>
					{cards.map((card) => (
						<LandingCard key={card.id} card={card} />
					))}
				</div>
			</div>
		</>
	);
}
