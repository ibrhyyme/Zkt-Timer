import React, {useEffect, useState} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {b, formatCs, getEventName} from '../shared';
import {Trophy} from 'phosphor-react';

const PODIUMS_QUERY = gql`
	query ZktPodiums($id: String!) {
		zktCompetitionPodiums(id: $id) {
			event_id
			round_id
			results {
				id
				user_id
				best
				average
				ranking
				single_record_tag
				average_record_tag
				user {
					id
					username
					profile {
						pfp_image {
							url
						}
					}
				}
			}
		}
	}
`;

const MEDAL_COLOR: Record<number, string> = {
	1: '#f5c518',
	2: '#c0c0c0',
	3: '#cd7f32',
};

export default function ZktPodiumsTab({detail}: {detail: any}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const [podiums, setPodiums] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res: any = await gqlMutate(PODIUMS_QUERY, {id: detail.id});
				if (!cancelled) setPodiums(res?.data?.zktCompetitionPodiums || []);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [detail.id]);

	if (loading) return <div className={b('empty')}>{t('loading')}</div>;
	if (podiums.length === 0) {
		return <div className={b('empty')}>{t('no_podiums_yet')}</div>;
	}

	return (
		<div className={b('podiums-tab')}>
			{podiums.map((p) => (
				<div key={p.event_id} className={b('podium-card')}>
					<div className={b('podium-header')}>
						<span className={`cubing-icon event-${p.event_id}`} />
						<h3>{getEventName(p.event_id)}</h3>
					</div>
					<div className={b('podium-list')}>
						{p.results.map((r: any) => (
							<div key={r.id} className={b('podium-row')}>
								<span
									className={b('podium-medal')}
									style={{background: MEDAL_COLOR[r.ranking] || '#888'}}
								>
									<Trophy weight="fill" /> {r.ranking}
								</span>
								{r.user?.profile?.pfp_image?.url && (
									<img
										className={b('user-avatar')}
										src={r.user.profile.pfp_image.url}
										alt=""
									/>
								)}
								<span className={b('podium-name')}>{r.user?.username || r.user_id}</span>
								<span className={b('podium-time')}>
									<span>{formatCs(r.best)}</span>
									{r.average !== null && r.average !== undefined && r.average > 0 && (
										<span className={b('podium-avg')}>
											{t('average')}: {formatCs(r.average)}
										</span>
									)}
								</span>
								<span className={b('podium-tags')}>
									{r.single_record_tag && (
										<span className={b('record-tag', {[r.single_record_tag.toLowerCase()]: true})}>
											{r.single_record_tag}
										</span>
									)}
									{r.average_record_tag && (
										<span className={b('record-tag', {[r.average_record_tag.toLowerCase()]: true})}>
											{r.average_record_tag} avg
										</span>
									)}
								</span>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
