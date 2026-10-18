import React, {useEffect, useState} from 'react';
import {useHistory} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import block from '../../styles/bem';
import PageTitle from '../common/page_title/PageTitle';
import {gqlQueryTyped} from '../api';
import {MyBattleRatingDocument} from '../../@types/generated/graphql';
import {useMe} from '../../util/hooks/useMe';
import {useOnlineStatus} from '../../util/hooks/useOnlineStatus';
import {useGeneral} from '../../util/hooks/useGeneral';
import LandingCard from '../trainer/landing/LandingCard';
import CardStack from '../trainer/landing/CardStack';
import type {CardView} from '../trainer/landing/card_view';
import '../trainer/common/TrainerAccents.scss';
import '../trainer/TrainerLanding.scss';
import {BATTLE_PUZZLE} from '../../../shared/battle/config';
import {useSearchingCount} from './online/useSearchingCount';
import Battle from './Battle';
import {useBattleLaunch} from './useBattleLaunch';
import {
	BATTLE_MODES,
	LandingRating,
	pickBattleLandingView,
	ratingLine,
	showSearchingCount,
} from './battle_landing_modes';
import './BattleLanding.scss';

const b = block('battle-landing');
/** The trainer hub's layout classes (trainer/TrainerLanding.scss). */
const tb = block('trainer');

/**
 * /battle (ranking-battle 5.1, 5.2). Until Online Battle is open to this user it draws the
 * offline battle exactly as before, so nothing changes for anyone while the flag is off.
 * Once open: two cards, Online Battle and Offline Battle. Renders on the server (no
 * scramble here); the offline battle itself stays client only.
 */
export default function BattleLanding() {
	const launch = useBattleLaunch();
	const networkOnline = useOnlineStatus();
	const view = pickBattleLandingView(launch, networkOnline);

	if (view === 'offline') return <Battle />;
	if (view === 'wait') return null;
	return <BattleLandingCards networkOnline={networkOnline} />;
}

/** The signed-in player's 3x3 rating for the online card; asked once per visit, never on the server. */
function useLandingRating(signedIn: boolean, networkOnline: boolean): {rating: LandingRating | null; loaded: boolean} {
	const [state, setState] = useState<{rating: LandingRating | null; loaded: boolean}>({rating: null, loaded: false});

	useEffect(() => {
		if (!signedIn || !networkOnline) return;
		let alive = true;
		gqlQueryTyped(MyBattleRatingDocument, {puzzle: BATTLE_PUZZLE}, {fetchPolicy: 'no-cache'})
			.then((res) => {
				if (!alive) return;
				const row = res?.data?.myBattleRating;
				setState({
					rating: row ? {rating: row.rating, provisional: !!row.provisional, games: row.games} : null,
					loaded: true,
				});
			})
			.catch(() => {
				// The line is optional; a failed read just leaves it out.
			});
		return () => {
			alive = false;
		};
	}, [signedIn, networkOnline]);

	return state;
}

function BattleLandingCards({networkOnline}: {networkOnline: boolean}) {
	const {t} = useTranslation();
	const history = useHistory();
	const me = useMe();
	const mobileMode = useGeneral('mobile_mode');
	const signedIn = !!me;
	const {rating, loaded} = useLandingRating(signedIn, networkOnline);
	// The server answers the count only for a signed-in socket.
	const searching = useSearchingCount(signedIn && networkOnline);
	const line = ratingLine(signedIn, rating, loaded);

	function onlineFooter(): React.ReactNode {
		if (!networkOnline) {
			return <p className={b('line', {strong: true})}>{t('online_battle.internet_required')}</p>;
		}
		const lines: React.ReactNode[] = [];
		if (line?.kind === 'rating') {
			lines.push(
				<p key="rating" className={b('line', {strong: true})}>
					{t('battle_landing.your_rating', {rating: line.rating})}
					{line.provisional ? (
						<span className={b('provisional')} title={t('online_battle.provisional')} aria-label={t('online_battle.provisional')}>
							?
						</span>
					) : null}
				</p>
			);
		}
		if (line?.kind === 'first_match') {
			lines.push(
				<p key="first" className={b('line', {strong: true})}>
					{t('battle_landing.first_match')}
				</p>
			);
		}
		if (showSearchingCount(searching)) {
			lines.push(
				<p key="searching" className={b('line')}>
					{t('online_battle.searching_count', {count: searching})}
				</p>
			);
		}
		return lines.length ? lines : null;
	}

	// The trainer hub's cards, so the two hubs read as one design (3.0-c). The tag ("Smart cube",
	// "2 players") is the card's eyebrow; the whole card opens the mode, as on the trainer hub. A
	// signed-out visitor still opens the mode, which then says what it needs (the account panel).
	const cards: CardView[] = BATTLE_MODES.map((mode) => ({
		id: mode.id,
		Icon: mode.Icon,
		accent: mode.accent,
		eyebrow: t(mode.tagKey),
		title: t(mode.titleKey),
		desc: t(mode.descKey),
		groupLabel: t('trainer.hub.whats_inside'),
		items: mode.featureKeys.map((key) => ({text: t(key)})),
		ctaLabel: t(mode.ctaKey),
		footer: mode.id === 'online' ? onlineFooter() : null,
		disabled: mode.id === 'online' && !networkOnline,
		onSelect: () => history.push(mode.link),
	}));

	if (mobileMode) {
		return (
			<div className={b()}>
				<div className={tb('landing', {stack: true})}>
					<PageTitle pageName={t('nav.battle')} />
					<CardStack cards={cards} />
				</div>
			</div>
		);
	}

	return (
		<div className={b()}>
			<div className={tb('landing', {hub: true})}>
				<div className={tb('landing-header')}>
					<h1 className={tb('landing-title')}>{t('nav.battle')}</h1>
					<p className={tb('landing-subtitle')}>{t('battle_landing.subtitle')}</p>
				</div>
				<div className={tb('landing-cards')}>
					{cards.map((card) => (
						<LandingCard key={card.id} card={card} />
					))}
				</div>
			</div>
		</div>
	);
}
