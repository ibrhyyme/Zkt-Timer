/**
 * HistoryView — session gecmisi, filter, pagination, PB rozet, trend ok.
 */
import React, {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {ArrowUp, ArrowDown, ClockClockwise, Crosshair, Lightning, Timer, Trash} from 'phosphor-react';
import Button, {CommonType} from '../../../common/button/Button';
import {useRecognitionContext} from '../RecognitionContext';
import {useSessionHistory} from '../hooks/useSessionHistory';
import {msToHumanReadable} from '../../../../util/trainer/recognition/time_formatter';
import {formatAccuracy, formatDate, sessionTypeKey} from '../../../../util/trainer/recognition/formatters';
import {buildSessionPool} from '../../../../util/trainer/recognition/session_sizing';
import type {RecognitionSessionRecord} from '../../../../db/recognition_db';

const b = block('trainer-recognition');

export default function HistoryView() {
	const {t} = useTranslation();
	const {startSession, setRecognitionView} = useRecognitionContext();
	const {
		sessions,
		sessionTypes,
		selectedType,
		setSelectedType,
		currentPage,
		setCurrentPage,
		totalPages,
		paginatedSessions,
		showingRange,
		pbMap,
		trendMap,
		removeSession,
	} = useSessionHistory();

	const handleDeleteSession = useCallback(
		(id: number | undefined) => {
			if (id === undefined) return;
			if (typeof window === 'undefined') return;
			const msg = t('trainer.recognition.history_delete_confirm', {
				defaultValue: 'Bu oturum kalıcı olarak silinecek. Devam edilsin mi?',
			});
			if (window.confirm(msg)) {
				removeSession(id).catch(() => {});
			}
		},
		[removeSession, t]
	);

	const repeatSession = useCallback(
		(s: RecognitionSessionRecord) => {
			const keys = s.poolKey.split(',');
			const pool = buildSessionPool(keys, s.sizeOption);
			startSession(pool, s.sizeOption, s.presetLabel);
			setRecognitionView('trainer');
		},
		[startSession, setRecognitionView]
	);

	return (
		<div className={b('history')}>
			<h3 className={b('history-title')}>
				{t('trainer.recognition.history_title', {defaultValue: 'Session History'})}
			</h3>

			{sessions.length === 0 ? (
				<div className={b('empty-state')}>
					<ClockClockwise weight="duotone" className={b('empty-state-icon')} />
					<h4 className={b('empty-state-title')}>
						{t('trainer.recognition.history_no_sessions', {defaultValue: 'No completed sessions yet'})}
					</h4>
					<p className={b('empty-state-desc')}>
						{t('trainer.recognition.history_empty_desc', {
							defaultValue: 'Tamamladığın ilk oturum burada görünür. PB rozetleri ve trend okları zamanla eklenir.',
						})}
					</p>
					<Button
						primary
						icon={<Lightning weight="fill" />}
						text={t('trainer.recognition.history_start', {defaultValue: 'Start a session'})}
						onClick={() => setRecognitionView('setup')}
					/>
				</div>
			) : (
				<div className={b('history-layout')}>
					<aside className={b('history-aside')}>
						<div className={b('history-summary')}>
							<span>
								<strong>{sessions.length}</strong>{' '}
								{t('trainer.recognition.history_sessions', {defaultValue: 'sessions'})}
							</span>
							<span>
								<strong>{sessionTypes.length}</strong>{' '}
								{t('trainer.recognition.history_presets', {defaultValue: 'presets'})}
							</span>
						</div>

						{sessionTypes.length > 1 && (
							<div className={b('history-filter')}>
								<select
									value={selectedType}
									onChange={(e) => setSelectedType(e.target.value)}
									className={b('select')}
									style={{width: '100%'}}
								>
									<option value="all">
										{t('trainer.recognition.history_all_types', {count: sessions.length, defaultValue: `All types (${sessions.length})`})}
									</option>
									{sessionTypes.map((tp) => (
										<option key={tp.key} value={tp.key}>
											{tp.label} ({tp.totalCases})
										</option>
									))}
								</select>
							</div>
						)}
					</aside>

					<div className={b('history-main')}>
						{totalPages > 1 && (
							<div style={{textAlign: 'center', opacity: 0.75, fontSize: '0.85rem'}}>
								{t('trainer.recognition.history_showing_range', {range: showingRange, defaultValue: `Showing ${showingRange}`})}
							</div>
						)}

						<div className={b('history-list')}>
						{paginatedSessions.map((s) => {
							const trend = trendMap.get(sessionTypeKey(s));
							const isPb = s.id !== undefined && pbMap.get(s.id);
							return (
								<div key={s.id} className={b('history-row')}>
									<div className={b('history-row-main')}>
										<div className={b('history-row-title')}>
											<span>{s.presetLabel}</span>
											{trend === 'up' && (
												<ArrowUp weight="bold" className={b('history-trend-up')} />
											)}
											{trend === 'down' && (
												<ArrowDown weight="bold" className={b('history-trend-down')} />
											)}
										</div>
										<div className={b('history-row-date')}>{formatDate(s.completedAt)}</div>
										<div className={b('history-row-stats')}>
											<span className={b('history-row-stat')}>
												<Crosshair /> {formatAccuracy(s.correctCount / s.totalCases)}
											</span>
											<span className={b('history-row-stat')}>
												<Timer /> {msToHumanReadable(s.avgTimeMs)}/case
											</span>
											<span className={b('history-row-cases')}>
												{t('trainer.recognition.history_cases_count', {
													correct: s.correctCount,
													total: s.totalCases,
													defaultValue: `${s.correctCount}/${s.totalCases} cases`,
												})}
											</span>
										</div>
									</div>
									<div className={b('history-row-actions')}>
										{isPb && <span className={b('pb-badge')}>PB</span>}
										<Button
											theme={CommonType.TRANSPARENT}
											small
											icon={<Lightning weight="fill" />}
											className={b('eval-cta-secondary')}
											onClick={() => repeatSession(s)}
											title={t('trainer.recognition.history_repeat', {defaultValue: 'Repeat this session'})}
											noMargin
										/>
										<Button
											theme={CommonType.TRANSPARENT}
											small
											icon={<Trash />}
											className={b('eval-cta-secondary', {danger: true})}
											onClick={() => handleDeleteSession(s.id)}
											title={t('trainer.recognition.history_delete', {defaultValue: 'Bu oturumu sil'})}
											noMargin
										/>
									</div>
								</div>
							);
						})}
					</div>

					{totalPages > 1 && (
						<div className={b('history-pagination')}>
							<Button
								theme={CommonType.GRAY}
								small
								disabled={currentPage === 1}
								text={t('trainer.recognition.history_prev', {defaultValue: 'Prev'})}
								onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
							/>
							<span style={{padding: '4px 12px', fontSize: '0.85rem', opacity: 0.85}}>
								{currentPage} / {totalPages}
							</span>
							<Button
								theme={CommonType.GRAY}
								small
								disabled={currentPage === totalPages}
								text={t('trainer.recognition.history_next', {defaultValue: 'Next'})}
								onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
							/>
						</div>
					)}
					</div>
				</div>
			)}
		</div>
	);
}
