/**
 * PbStats — preset karti icindeki PB rozeti.
 */
import React from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {Crosshair, Star, Timer} from 'phosphor-react';
import {formatAccuracy} from '../../../../util/trainer/recognition/formatters';
import {msToHumanReadable} from '../../../../util/trainer/recognition/time_formatter';
import type {PersonalBest} from '../../../../util/trainer/recognition/session_history';

const b = block('trainer-recognition');

interface PbStatsProps {
	pb: PersonalBest;
}

export default function PbStats({pb}: PbStatsProps) {
	const {t} = useTranslation();
	const mastered = pb.bestAccuracy >= 1;
	return (
		<div className={b('pb-stats')}>
			{mastered ? (
				<div className={b('pb-stats-row')}>
					<Star weight="fill" />
					<span className={b('pb-stats-mastered')}>
						{t('trainer.recognition.pb_mastered', {defaultValue: 'Mastered'})}
					</span>
				</div>
			) : (
				<div className={b('pb-stats-row')}>
					<Crosshair />
					<span className={b('pb-stats-accuracy')}>{formatAccuracy(pb.bestAccuracy)}</span>
				</div>
			)}
			<div className={b('pb-stats-row') + ' ' + b('pb-stats-time')}>
				<Timer />
				<span>{msToHumanReadable(pb.bestAvgTimeMs)}/case</span>
			</div>
			<div className={b('pb-stats-sessions')}>
				{pb.totalSessions} {pb.totalSessions !== 1 ? 'sessions' : 'session'}
			</div>
		</div>
	);
}
