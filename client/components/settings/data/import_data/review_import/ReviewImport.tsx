import React, { ReactNode, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import './ReviewImport.scss';
import block from '../../../../../styles/bem';
import { X } from 'phosphor-react';
import { ImportDataContext } from '../ImportData';
import Button from '../../../../common/button/Button';
import { toastError, toastSuccess, toastWarning } from '../../../../../util/toast';
import { CHUNK_SIZE, importSessionsInChunks, importSolvesInChunks } from './chunked_import';
import ImportProgressDisplay from './progress_display/ImportProgressDisplay';
import ImportErrorSummary from './error_summary/ImportErrorSummary';
import ImportSection from '../import_section/ImportSection';
import { clearOfflineData } from '../../../../layout/offline';
import CubePicker from '../../../../common/cube_picker/CubePicker';
import Input from '../../../../common/inputs/input/Input';
import InputLegend from '../../../../common/inputs/input/input_legend/InputLegend';
import { normalizeBucketForImport } from '../parse_data/normalize-bucket';

const b = block('review-import');

export default function ReviewImport() {
	const { t } = useTranslation();
	const context = useContext(ImportDataContext);

	const data = context.importableData;
	if (!data) {
		return null;
	}

	async function importData() {
		context.setImporting(true);
		context.setImportProgress(null);
		context.setImportResults(null);

		try {
			// Phase 1: Import sessions in chunks
			console.log(`[Import] Importing ${data.sessions.length} sessions in chunks...`);
			const sessionResult = await importSessionsInChunks(
				data.sessions,
				(progress) => context.setImportProgress(progress)
			);

			console.log('[Import] Session import result:', sessionResult);

			// CRITICAL: Stop if any session chunks failed
			if (sessionResult.failureCount > 0) {
				context.setImporting(false);
				context.setImportResults(sessionResult);
				toastError(t('data_settings.session_import_failed', { count: sessionResult.failureCount }));
				console.error('[Import] Session import errors:', sessionResult.errors);
				return;
			}

			// Phase 2: Import solves in chunks
			console.log(`[Import] Importing ${data.solves.length} solves in chunks...`);
			const solveResult = await importSolvesInChunks(
				data.solves,
				(progress) => context.setImportProgress(progress)
			);

			console.log('[Import] Solve import result:', solveResult);

			// Phase 3: Combine results
			const combinedResults = {
				successCount: sessionResult.successCount + solveResult.successCount,
				failureCount: sessionResult.failureCount + solveResult.failureCount,
				errors: [...sessionResult.errors, ...solveResult.errors],
			};

			context.setImportResults(combinedResults);

			// Phase 4: Handle completion
			if (combinedResults.failureCount === 0) {
				// Complete success
				console.log('[Import] All chunks imported successfully!');
				await clearOfflineData();
				toastSuccess(t('data_settings.import_success', { sessions: data.sessions.length, solves: data.solves.length }));
				setTimeout(() => {
					window.location.href = '/sessions';
				}, 1500);
			} else {
				// Partial failure - show error summary
				console.error('[Import] Some chunks failed:', combinedResults.errors);
				context.setImporting(false);
				toastError(t('data_settings.import_failed', { count: combinedResults.failureCount }));
			}

		} catch (e) {
			console.error('[Import] Fatal error:', e);
			context.setImporting(false);
			toastError(e.message);
		}
	}

	async function retryFailedChunks() {
		const results = context.importResults;
		if (!results || results.errors.length === 0) return;

		context.setImporting(true);
		context.setImportProgress(null);
		toastWarning(t('data_settings.retry_in_progress'));

		try {
			const sessionErrors = results.errors.filter((e) => e.type === 'sessions');
			const solveErrors = results.errors.filter((e) => e.type === 'solves');

			let retryResult = {
				successCount: results.successCount,
				failureCount: 0,
				errors: [],
			};

			if (sessionErrors.length > 0) {
				const failedSessions = [];
				for (const err of sessionErrors) {
					const start = err.chunkIndex * CHUNK_SIZE;
					const end = start + CHUNK_SIZE;
					failedSessions.push(...data.sessions.slice(start, end));
				}

				const sessionResult = await importSessionsInChunks(failedSessions, (progress) =>
					context.setImportProgress(progress)
				);

				retryResult.successCount += sessionResult.successCount;
				retryResult.failureCount += sessionResult.failureCount;
				retryResult.errors.push(...sessionResult.errors);

				if (sessionResult.failureCount > 0) {
					context.setImportResults(retryResult);
					context.setImporting(false);
					toastError(t('data_settings.retry_partial_fail', { count: sessionResult.failureCount }));
					return;
				}

				// Session'lar basarili oldu, simdi tum solve'lari import et
				const solveResult = await importSolvesInChunks(data.solves, (progress) =>
					context.setImportProgress(progress)
				);

				retryResult.successCount += solveResult.successCount;
				retryResult.failureCount += solveResult.failureCount;
				retryResult.errors.push(...solveResult.errors);
			} else if (solveErrors.length > 0) {
				const failedSolves = [];
				for (const err of solveErrors) {
					const start = err.chunkIndex * CHUNK_SIZE;
					const end = start + CHUNK_SIZE;
					failedSolves.push(...data.solves.slice(start, end));
				}

				const solveResult = await importSolvesInChunks(failedSolves, (progress) =>
					context.setImportProgress(progress)
				);

				retryResult.successCount += solveResult.successCount;
				retryResult.failureCount += solveResult.failureCount;
				retryResult.errors.push(...solveResult.errors);
			}

			context.setImportResults(retryResult);

			if (retryResult.failureCount === 0) {
				await clearOfflineData();
				toastSuccess(t('data_settings.retry_success'));
				setTimeout(() => {
					window.location.href = '/sessions';
				}, 1500);
			} else {
				context.setImporting(false);
				toastError(t('data_settings.retry_partial_fail', { count: retryResult.failureCount }));
			}
		} catch (e) {
			console.error('[Import Retry] Fatal error:', e);
			context.setImporting(false);
			toastError(e.message);
		}
	}

	function updateSessionName(sessionId: string, sessionName: string) {
		const sessions = data.sessions;
		for (const session of sessions) {
			if (session.id === sessionId) {
				session.name = sessionName;
				break;
			}
		}

		context.setImportableData({
			...data,
			sessions,
		});
	}

	function removeSession(sessionId: string) {
		const sessions = [...data.sessions];
		for (let i = 0; i < sessions.length; i += 1) {
			const session = sessions[i];
			if (session.id === sessionId) {
				sessions.splice(i, 1);
				break;
			}
		}

		const newSolves = [];
		for (const solve of data.solves) {
			if (solve.session_id !== sessionId) {
				newSolves.push(solve);
			}
		}

		context.setImportableData({
			...data,
			sessions,
			solves: newSolves,
		});
	}

	function updateSessionCubeType(sessionId: string, cubeType: string) {
		const newSessionId = {
			...data.sessionIdCubeTypeMap,
			[sessionId]: cubeType,
		};

		// Kullanici override yapinca subset'i de paralelde guncelle.
		// Tanimlanmamis cube_type secilirse normalize null doner — degisiklik uygulanmaz.
		const normalized = normalizeBucketForImport(cubeType);
		if (!normalized) {
			toastError(t('data_settings.invalid_cube_type'));
			return;
		}

		const solves = [...data.solves];
		for (const solve of solves) {
			if (solve.session_id === sessionId) {
				solve.cube_type = normalized.cube_type;
				solve.scramble_subset = normalized.scramble_subset;
			}
		}

		context.setImportableData({
			...data,
			sessionIdCubeTypeMap: newSessionId,
			solves,
		});
	}

	let sessionMapper: ReactNode[] = [];
	if (data.sessionIdCubeTypeMap) {
		sessionMapper = data.sessions.map((session) => {
			const cubeType = data.sessionIdCubeTypeMap[session.id];
			return (
				<div className={b('session')} key={session.id}>
					<div>
						<Input value={session.name} onChange={(e) => updateSessionName(session.id, e.target.value)} />
					</div>
					<div>
						<CubePicker onChange={(ct) => updateSessionCubeType(session.id, ct.id)} value={cubeType} />
					</div>
					<div>
						<Button icon={<X />} onClick={() => removeSession(session.id)} transparent />
					</div>
				</div>
			);
		});

		sessionMapper.splice(
			0,
			0,
			<div className={b('session-header')} key="session-header-row">
				<InputLegend large text={t('data_settings.session_name')} />
				<InputLegend large text={t('data_settings.cube_type')} />
				<InputLegend large text={t('data_settings.remove')} />
			</div>
		);
	}

	return (
		<div className={b()}>
			<hr />
			<ImportSection
				title={t('data_settings.review_and_import')}
				description={t('data_settings.review_description')}
			>
				<div className={b('stats')}>
					<h4>
						{t('data_settings.solves_count', { count: data.solves.length })}
					</h4>
					<h4>
						{t('data_settings.sessions_count', { count: data.sessions.length })}
					</h4>
					{!!data.skippedSolveCount && (
						<div className={b('skipped')} style={{ color: '#f59e0b', fontSize: '0.9rem', marginTop: 8 }}>
							<strong>{t('data_settings.skipped_count', { count: data.skippedSolveCount })}</strong>
							{data.skippedCubeTypes && (
								<ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
									{Object.entries(data.skippedCubeTypes).map(([ct, n]) => (
										<li key={ct}>
											{ct}: {n.toLocaleString()}
										</li>
									))}
								</ul>
							)}
						</div>
					)}
					{sessionMapper}
				</div>
				{context.importProgress && (
					<ImportProgressDisplay progress={context.importProgress} />
				)}
				{context.importResults && context.importResults.failureCount > 0 && (
					<ImportErrorSummary
						results={context.importResults}
						onRetry={retryFailedChunks}
					/>
				)}
				<Button
					loading={context.importing}
					text={context.importProgress
						? t('data_settings.importing_progress', { percent: context.importProgress.percentComplete })
						: t('data_settings.import')
					}
					primary
					large
					glow
					disabled={context.importing}
					onClick={importData}
				/>
			</ImportSection>
		</div>
	);
}
