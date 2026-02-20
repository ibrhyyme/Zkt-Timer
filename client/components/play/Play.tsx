import React from 'react';
import { Lightning, Sword } from 'phosphor-react';
import './Play.scss';
import { GameType } from '../../../shared/match/consts';
import HeadToHead from './logic/HeadToHead';
import Elimination from './logic/Elimination';
import i18next from 'i18next';

export interface GameMetaData {
	id: string;
	icon: React.ReactElement;
	description: string;
	name: string;
	color: string;
}

export function getGameTypeData(): Record<GameType, GameMetaData> {
	const t = i18next.t.bind(i18next);
	return {
		[GameType.HEAD_TO_HEAD]: {
			id: 'head-to-head',
			icon: <Lightning weight="fill" />,
			description: t('play.1v1_description'),
			name: '1v1',
			color: '#ff9800',
		},
		[GameType.ELIMINATION]: {
			id: 'elimination',
			icon: <Sword weight="fill" />,
			description: t('play.elimination_description'),
			name: t('play.elimination'),
			color: '#42a5f5',
		},
	};
}

export function getGameMetaData(gameType: GameType) {
	return getGameTypeData()[gameType];
}

export default function Play() {
	return (
		<div className="mx-auto flex flex-row items-center justify-center">
			<div className="mx-auto flex flex-row flex-wrap gap-3">
				<PlayRow>
					<HeadToHead />
				</PlayRow>
				<PlayRow>
					<Elimination />
				</PlayRow>
			</div>
		</div>
	);
}

interface PlayRowProps {
	children: React.ReactNode;
}

function PlayRow(props: PlayRowProps) {
	return (
		<div className="w-full max-w-md rounded-lg border-4 border-solid border-slate-300/10 p-5">{props.children}</div>
	);
}
