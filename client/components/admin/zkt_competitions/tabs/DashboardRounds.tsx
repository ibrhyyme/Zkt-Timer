import React from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {toastSuccess, toastError} from '../../../../util/toast';
import {b, getEventName, ZKT_ROUND_FORMATS} from '../shared';
import {Plus, Minus} from 'phosphor-react';
import EditTimeLimitModal from '../modals/EditTimeLimitModal';
import EditCutoffModal from '../modals/EditCutoffModal';
import EditAdvancementModal from '../modals/EditAdvancementModal';

const CREATE_ROUND = gql`
	mutation CreateZktRound($input: CreateZktRoundInput!) {
		createZktRound(input: $input) {
			id
		}
	}
`;

const UPDATE_ROUND = gql`
	mutation UpdateZktRound($input: UpdateZktRoundInput!) {
		updateZktRound(input: $input) {
			id
		}
	}
`;

const DELETE_ROUND = gql`
	mutation DeleteZktRound($roundId: String!) {
		deleteZktRound(roundId: $roundId)
	}
`;

const UPDATE_ROUND_STATUS = gql`
	mutation UpdateZktRoundStatus($input: UpdateZktRoundStatusInput!) {
		updateZktRoundStatus(input: $input) {
			id
			status
		}
	}
`;

export default function DashboardRounds({
	detail,
	onUpdated,
}: {
	detail: any;
	onUpdated: () => void;
}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});

	async function addRound(compEvent: any) {
		const nextNumber = (compEvent.rounds.length || 0) + 1;
		try {
			await gqlMutate(CREATE_ROUND, {
				input: {compEventId: compEvent.id, roundNumber: nextNumber, format: 'AO5'},
			});
			toastSuccess(t('round_added'));
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function removeLastRound(compEvent: any) {
		const lastRound = compEvent.rounds[compEvent.rounds.length - 1];
		if (!lastRound) return;
		try {
			await gqlMutate(DELETE_ROUND, {roundId: lastRound.id});
			toastSuccess(t('round_deleted'));
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function updateRound(roundId: string, patch: Record<string, any>) {
		try {
			await gqlMutate(UPDATE_ROUND, {input: {roundId, ...patch}});
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function setStatus(roundId: string, status: string) {
		try {
			await gqlMutate(UPDATE_ROUND_STATUS, {input: {roundId, status}});
			toastSuccess(t('status_updated'));
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	return (
		<div className={b('event-card-grid')}>
			{detail.events.map((ev: any) => (
				<div key={ev.id} className={b('event-pane')}>
					<div className={b('event-pane-header')}>
						<div className={b('event-pane-title')}>
							<span className={`cubing-icon event-${ev.event_id}`} />
							<span>{getEventName(ev.event_id)}</span>
						</div>
						<div className={b('event-pane-actions')}>
							<button
								className={b('round-count-btn')}
								onClick={() => removeLastRound(ev)}
								disabled={ev.rounds.length === 0}
								title={t('remove_round')}
							>
								<Minus weight="bold" />
							</button>
							<span style={{padding: '0 0.4rem', fontSize: 13, fontWeight: 600}}>
								{ev.rounds.length}
							</span>
							<button
								className={b('round-count-btn')}
								onClick={() => addRound(ev)}
								title={t('add_round')}
							>
								<Plus weight="bold" />
							</button>
						</div>
					</div>

					{ev.rounds.length === 0 ? (
						<div className={b('empty')}>{t('no_rounds')}</div>
					) : (
						ev.rounds.map((round: any) => (
							<div key={round.id} className={b('round-row-card')}>
								<div className={b('round-row-title')}>
									<span>{t('round_n', {n: round.round_number})}</span>
									<span className={b('round-status', {[round.status.toLowerCase()]: true})}>
										{t(`round_status_${round.status.toLowerCase()}`)}
									</span>
								</div>

								<div className={b('round-row-fields')}>
									<div className={b('round-field')}>
										<span className={b('round-field-label')}>{t('format')}</span>
										<select
											className={b('round-field-btn')}
											value={round.format}
											onChange={(e) => updateRound(round.id, {format: e.target.value})}
										>
											{ZKT_ROUND_FORMATS.map((f) => (
												<option key={f.id} value={f.id}>
													{f.name}
												</option>
											))}
										</select>
									</div>

									<div className={b('round-field')}>
										<span className={b('round-field-label')}>{t('time_limit')}</span>
										<EditTimeLimitModal
											value={round.time_limit_cs}
											onChange={(cs) => updateRound(round.id, {timeLimitCs: cs})}
										/>
									</div>

									<div className={b('round-field')}>
										<span className={b('round-field-label')}>{t('cutoff')}</span>
										<EditCutoffModal
											cutoffCs={round.cutoff_cs}
											cutoffAttempts={round.cutoff_attempts}
											onChange={({cutoffCs, cutoffAttempts}) =>
												updateRound(round.id, {cutoffCs, cutoffAttempts})
											}
										/>
									</div>

									<div className={b('round-field')}>
										<span className={b('round-field-label')}>{t('advancement')}</span>
										<EditAdvancementModal
											type={round.advancement_type}
											level={round.advancement_level}
											onChange={({type, level}) =>
												updateRound(round.id, {advancementType: type, advancementLevel: level})
											}
										/>
									</div>
								</div>

								<div className={b('round-row-footer')}>
									{round.status === 'UPCOMING' && (
										<button
											className={b('modal-btn', {primary: true})}
											onClick={() => setStatus(round.id, 'OPEN')}
										>
											{t('open_round')}
										</button>
									)}
									{round.status === 'OPEN' && (
										<button
											className={b('modal-btn', {primary: true})}
											onClick={() => setStatus(round.id, 'ACTIVE')}
										>
											{t('activate_round')}
										</button>
									)}
								</div>
							</div>
						))
					)}
				</div>
			))}
		</div>
	);
}
