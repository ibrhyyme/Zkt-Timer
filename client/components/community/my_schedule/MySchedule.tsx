import React, {Suspense} from 'react';
import {useTranslation} from 'react-i18next';
import {useRouteMatch, useHistory} from 'react-router-dom';
import {ArrowLeft} from 'phosphor-react';
import Header from '../../layout/header/Header';
import CompetitionLoader from './CompetitionLoader';
import CompetitionList from './CompetitionList';
import CompetitionDetail from './CompetitionDetail';
import CompetitorDetail from './CompetitorDetail';
import ActivityDetail from './ActivityDetail';
import PersonalBests from './PersonalBests';
import {resourceUri} from '../../../util/storage';

// Code splitting: WCA Live tab sadece kullanildiginda yuklensin
const WcaLiveTab = React.lazy(() => import('./wca_live/WcaLiveTab'));
import {b} from './shared';
import {useMe} from '../../../util/hooks/useMe';
import {isPremium} from '../../../lib/pro';
import './MySchedule.scss';

export default function MySchedule() {
	const {t} = useTranslation();
	const history = useHistory();
	const me = useMe();

	// Premium degilse Pro upgrade sayfasina yonlendir
	if (!isPremium(me)) {
		history.replace('/account/pro');
		return null;
	}

	const matchPersonalBests = useRouteMatch<{competitionId: string; wcaId: string}>(
		'/community/competitions/:competitionId/personal-bests/:wcaId'
	);
	const matchPerson = useRouteMatch<{competitionId: string; registrantId: string}>(
		'/community/competitions/:competitionId/persons/:registrantId'
	);
	const matchActivity = useRouteMatch<{competitionId: string; activityCode: string}>(
		'/community/competitions/:competitionId/activities/:activityCode'
	);
	const matchWcaLiveRound = useRouteMatch<{competitionId: string; eventId: string; roundNumber: string}>(
		'/community/competitions/:competitionId/wca-live/:eventId/:roundNumber'
	);
	const matchWcaLiveEvent = useRouteMatch<{competitionId: string; eventId: string}>(
		'/community/competitions/:competitionId/wca-live/:eventId'
	);
	const matchWcaLive = useRouteMatch<{competitionId: string}>(
		'/community/competitions/:competitionId/wca-live'
	);
	const matchCompetition = useRouteMatch<{competitionId: string}>(
		'/community/competitions/:competitionId'
	);

	// competitionId'yi herhangi bir match'ten al
	const competitionId = matchPersonalBests?.params.competitionId
		|| matchPerson?.params.competitionId
		|| matchActivity?.params.competitionId
		|| matchWcaLiveRound?.params.competitionId
		|| matchWcaLiveEvent?.params.competitionId
		|| matchWcaLive?.params.competitionId
		|| matchCompetition?.params.competitionId;

	// Yarisma sayfalarinin hepsi tek CompetitionLoader altinda
	if (competitionId) {
		let child: React.ReactNode;

		if (matchPersonalBests) {
			child = <PersonalBests wcaId={matchPersonalBests.params.wcaId} />;
		} else if (matchPerson) {
			child = <CompetitorDetail registrantId={parseInt(matchPerson.params.registrantId, 10)} />;
		} else if (matchActivity) {
			child = <ActivityDetail activityCode={matchActivity.params.activityCode} />;
		} else if (matchWcaLiveRound || matchWcaLiveEvent || matchWcaLive) {
			const eventId = matchWcaLiveRound?.params.eventId || matchWcaLiveEvent?.params.eventId || null;
			const roundNumber = matchWcaLiveRound?.params.roundNumber
				? parseInt(matchWcaLiveRound.params.roundNumber, 10)
				: null;
			const isRoot = !eventId;
			child = (
				<>
					{isRoot ? (
						<button className={b('back')} onClick={() => history.push(`/community/competitions/${competitionId}`)}>
							<ArrowLeft size={18} />
							{t('my_schedule.back_to_competition')}
						</button>
					) : (
						<button className={b('back')} onClick={() => history.goBack()}>
							<ArrowLeft size={18} />
							{t('my_schedule.back')}
						</button>
					)}
					<Suspense fallback={
						<div className={b('wca-loading')}>
							<img src={resourceUri('/images/logos/wca_logo.svg')} alt="WCA" className={b('wca-loading-logo')} />
							<div className={b('wca-loading-bar')}>
								<div className={b('wca-loading-bar-fill')} />
							</div>
							<span className={b('wca-loading-text')}>{t('my_schedule.loading')}</span>
						</div>
					}>
						<WcaLiveTab eventId={eventId} roundNumber={roundNumber} />
					</Suspense>
				</>
			);
		} else {
			child = (
				<>
					<button className={b('back')} onClick={() => history.push('/community/competitions')}>
						<ArrowLeft size={18} />
						{t('my_schedule.back_to_list')}
					</button>
					<CompetitionDetail />
				</>
			);
		}

		return (
			<div className={b()}>
				<Header path="/community/competitions" title={t('my_schedule.page_title')} />
				<div className={b('content')}>
					<CompetitionLoader competitionId={competitionId}>
						{child}
					</CompetitionLoader>
				</div>
			</div>
		);
	}

	// Yarisma listesi
	return (
		<div className={b()}>
			<Header path="/community/competitions" title={t('my_schedule.page_title')} />
			<CompetitionList />
		</div>
	);
}
