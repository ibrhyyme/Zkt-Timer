import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useDispatch} from 'react-redux';
import block from '../../../styles/bem';
import {useMe} from '../../../util/hooks/useMe';
import {gqlMutateTyped} from '../../api';
import {AnswerWelcomeSurveyDocument} from '../../../@types/generated/graphql';
import {ACQUISITION_SOURCES, AcquisitionSource} from '../../../../shared/welcome';
import {toastError} from '../../../util/toast';
import './WelcomeSurvey.scss';

const b = block('welcome-survey');

interface Props {
	/** The welcome message these choices answer. */
	messageId: string;
	/** The floating bubble window is narrow, so the chips shrink there. */
	compact?: boolean;
	/** The reply the server posted into the thread, for a list that wants it at once. */
	onAnswered?: (message: any) => void;
}

/**
 * The "where did you hear about us" choices under the welcome message.
 *
 * One tap records the answer and posts it as the member's reply, so it reads as a normal
 * conversation on both sides. Gone once answered: the answer lives on `me`, so the chips
 * do not come back on another device or after a reload.
 */
export default function WelcomeSurvey({messageId, compact, onAnswered}: Props) {
	const {t} = useTranslation();
	const dispatch = useDispatch();
	const me = useMe();
	const [sending, setSending] = useState<AcquisitionSource | null>(null);

	if (!me || me.acquisition_source) return null;

	async function answer(source: AcquisitionSource) {
		if (sending) return;
		setSending(source);
		try {
			const res = await gqlMutateTyped(AnswerWelcomeSurveyDocument, {messageId, source});
			dispatch({type: 'SET_ME', payload: {me: {...me, acquisition_source: source}}});
			const sent = res?.data?.answerWelcomeSurvey;
			if (sent) onAnswered?.(sent);
		} catch (e) {
			toastError(e as Error);
			setSending(null);
		}
	}

	return (
		<div className={b({compact})} role="group" aria-label={t('welcome_message.question')}>
			{ACQUISITION_SOURCES.map((source) => (
				<button
					key={source}
					type="button"
					className={b('choice', {active: sending === source})}
					disabled={Boolean(sending)}
					onClick={() => void answer(source)}
				>
					{t(`welcome_message.sources.${source}`)}
				</button>
			))}
		</div>
	);
}
