import React from 'react';
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
import {b} from './shared';
import {useMe} from '../../../util/hooks/useMe';
import {isPremium} from '../../../lib/pro';
import './MySchedule.scss';

export default function MySchedule() {
	const {t} = useTranslation();
	const history = useHistory();
	const me = useMe();

	// Premium degilse erisim yok
	if (!isPremium(me)) {
		history.replace('/community/friends/list');
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
	const matchCompetition = useRouteMatch<{competitionId: string}>(
		'/community/competitions/:competitionId'
	);

	// competitionId'yi herhangi bir match'ten al
	const competitionId = matchPersonalBests?.params.competitionId
		|| matchPerson?.params.competitionId
		|| matchActivity?.params.competitionId
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
