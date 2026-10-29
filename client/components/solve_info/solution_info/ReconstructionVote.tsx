import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@apollo/client';
import { ThumbsDown, ThumbsUp } from 'phosphor-react';
import IconButton from '../../common/icon_button/IconButton';
import block from '../../../styles/bem';
import {
	SolveReplayDataDocument,
	SolveReplayDataQueryVariables,
	VoteReconstructionDocument,
} from '../../../@types/generated/graphql';
import { toastError } from '../../../util/toast';
import './ReconstructionVote.scss';

const b = block('solve-info-reconstruction-vote');

interface Props {
	/** The variables SolutionInfo read the replay data with: the cache entry kept in step. */
	replayVariables: SolveReplayDataQueryVariables;
	/** The owner's stored verdict: 1 right, -1 wrong, null none yet. */
	vote: number | null;
}

/**
 * Right / wrong on the gyro reconstruction, asked of the solve's owner. Wrong ones are the real
 * cases the detector is tuned on (scripts/export-reconstruction-feedback.ts), so this is
 * the cheapest signal we have of where it fails. Pressing the chosen one again takes it back.
 */
export default function ReconstructionVote({ replayVariables, vote: stored }: Props) {
	const { t } = useTranslation();
	const [vote, setVote] = useState<number | null>(stored);
	useEffect(() => setVote(stored), [stored]);

	const [send] = useMutation(VoteReconstructionDocument);

	async function choose(choice: 1 | -1) {
		const next = vote === choice ? 0 : choice;
		const before = vote;
		setVote(next || null);
		try {
			const result = await send({
				variables: { id: replayVariables.id, vote: next },
				// Keep the cached replay data in step, so reopening the solve shows the choice.
				update(cache, { data }) {
					if (!data?.voteReconstruction) return;
					const query = { query: SolveReplayDataDocument, variables: replayVariables };
					const cached = cache.readQuery(query);
					if (!cached?.solveReplayData) return;
					cache.writeQuery({ ...query, data: { solveReplayData: { ...cached.solveReplayData, reconstruction_vote: next || null } } });
				},
			});
			if (!result.data?.voteReconstruction) setVote(before);
		} catch {
			setVote(before);
			toastError(t('solve_info.reconstruction_vote.failed'));
		}
	}

	return (
		<div className={b()}>
			<span className={b('question')}>
				{vote ? t('solve_info.reconstruction_vote.thanks') : t('solve_info.reconstruction_vote.question')}
			</span>
			<IconButton
				size="sm"
				variant="ghost"
				className={b('choice', { chosen: vote === 1 })}
				label={t('solve_info.reconstruction_vote.right')}
				icon={<ThumbsUp weight={vote === 1 ? 'fill' : 'regular'} />}
				onClick={() => choose(1)}
			/>
			<IconButton
				size="sm"
				variant="ghost"
				className={b('choice', { chosen: vote === -1 })}
				label={t('solve_info.reconstruction_vote.wrong')}
				icon={<ThumbsDown weight={vote === -1 ? 'fill' : 'regular'} />}
				onClick={() => choose(-1)}
			/>
		</div>
	);
}
