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
import SubsetPicker from '../../../../timer/header_control/SubsetPicker';
import Input from '../../../../common/inputs/input/Input';
import InputLegend from '../../../../common/inputs/input/input_legend/InputLegend';
import { VARIANT_MAP } from '../parse_data/normalize-bucket';
import { getSubsetsForCube } from '../../../../../util/cubes/scramble_subsets';
import { getCubeTypeBucketLabel } from '../../../../../util/cubes/util';
import { SessionInput } from '../../../../../@types/generated/graphql';

// Import only registers WCA events (cube_type='wca' + this subset).
// Method-based cube_type's (333cfop/roux/mehta/zz, 444yau, other, wca parent) are not shown.
const WCA_IMPORT_EVENTS = ['333', '222', '444', '555', '666', '777', 'sq1', 'pyram', 'clock', 'skewb', 'minx'];

// Method-based cube_type's (333cfop/333roux/etc.) reduced to parent WCA event.
function getParentWcaEvent(input: string): string {
	if (!input) return '333';
	if (WCA_IMPORT_EVENTS.includes(input)) return input;
	const variant = VARIANT_MAP[input];
	if (variant) {
		const ct = variant.cube_type;
		if (WCA_IMPORT_EVENTS.includes(ct)) return ct;
		if (ct.startsWith('333')) return '333';
		if (ct.startsWith('222')) return '222';
		if (ct.startsWith('444')) return '444';
		if (ct.startsWith('555')) return '555';
	}
	return input;
}

// Converts the value held as a single string in sessionIdCubeTypeMap (cube or subset id)
// to the {cubeType, subset} pair that the UI consumes.
function deriveBucket(rawId: string): { cubeType: string; subset: string | null } {
	if (!rawId) return { cubeType: '333', subset: null };
	const variant = VARIANT_MAP[rawId];
	if (variant) {
		// VARIANT_MAP cube_type can be method-based (333roux etc.). UI shows WCA event,
		// subset carries the real information; method info goes into solve.cube_type invisibly to user.
		const wcaParent = WCA_IMPORT_EVENTS.includes(variant.cube_type)
			? variant.cube_type
			: getParentWcaEvent(variant.cube_type);
		return { cubeType: wcaParent, subset: variant.scramble_subset };
	}
	if (WCA_IMPORT_EVENTS.includes(rawId)) return { cubeType: rawId, subset: null };
	return { cubeType: getParentWcaEvent(rawId), subset: null };
}

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

				// Sessions succeeded, now import all solves
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

	// Returns (cube_type, subset) combinations and solve counts within a session.
	// Used for mixed session detection.
	function getSessionBuckets(sessionId: string): Map<string, number> {
		const buckets = new Map<string, number>();
		for (const sv of data.solves) {
			if (sv.session_id !== sessionId) continue;
			const key = `${sv.cube_type}/${sv.scramble_subset ?? ''}`;
			buckets.set(key, (buckets.get(key) || 0) + 1);
		}
		return buckets;
	}

	// Splits a mixed session into sub-sessions based on (cube_type, subset).
	// The old session name is added to each new session as a suffix (e.g. "Practice (2x2)").
	function splitSession(sessionId: string) {
		const buckets = getSessionBuckets(sessionId);
		if (buckets.size <= 1) return;

		const oldSession = data.sessions.find(s => s.id === sessionId);
		if (!oldSession) return;

		const newSessions: SessionInput[] = [];
		const newSessionMap = { ...data.sessionIdCubeTypeMap };
		const solves = [...data.solves];

		let order = oldSession.order;
		for (const [bucketKey] of buckets) {
			const [cube_type, subsetRaw] = bucketKey.split('/');
			const subset = subsetRaw === '' ? null : subsetRaw;
			const newId = `${oldSession.id}__${cube_type}_${subset ?? 'default'}`;
			const label = getCubeTypeBucketLabel(cube_type, subset);
			newSessions.push({
				id: newId,
				name: `${oldSession.name} (${label})`,
				order: order++,
			});
			newSessionMap[newId] = subset ?? cube_type;
			for (const sv of solves) {
				if (sv.session_id === sessionId &&
					sv.cube_type === cube_type &&
					(sv.scramble_subset ?? '') === (subset ?? '')) {
					sv.session_id = newId;
				}
			}
		}
		delete newSessionMap[sessionId];

		const sessions = data.sessions
			.filter(s => s.id !== sessionId)
			.concat(newSessions);

		context.setImportableData({ ...data, sessions, solves, sessionIdCubeTypeMap: newSessionMap });
	}

	function updateSessionBucket(sessionId: string, cubeType: string, subset: string | null) {
		// sessionIdCubeTypeMap holds a single string: subset if present, otherwise cube_type.
		const flatKey = subset ?? cubeType;
		const newSessionMap = {
			...data.sessionIdCubeTypeMap,
			[sessionId]: flatKey,
		};

		const solves = [...data.solves];
		for (const solve of solves) {
			if (solve.session_id !== sessionId) continue;
			if (WCA_IMPORT_EVENTS.includes(cubeType)) {
				// WCA bucket: cube_type='wca', subset = selected subset or parent event
				solve.cube_type = 'wca';
				solve.scramble_subset = subset ?? cubeType;
			} else {
				// Method-based cube_type (333cfop, 333roux, etc.) — as-is
				solve.cube_type = cubeType;
				solve.scramble_subset = subset;
			}
		}

		context.setImportableData({
			...data,
			sessionIdCubeTypeMap: newSessionMap,
			solves,
		});
	}

	let sessionMapper: ReactNode[] = [];
	if (data.sessionIdCubeTypeMap) {
		sessionMapper = data.sessions.map((session) => {
			const rawId = data.sessionIdCubeTypeMap[session.id];
			const { cubeType, subset } = deriveBucket(rawId);
			const subsets = getSubsetsForCube(cubeType);
			const sessionBuckets = getSessionBuckets(session.id);
			const isMixed = sessionBuckets.size > 1;
			// Show subset picker only if there are meaningful options (apart from default).
			// If 1 item (only random_state), hide it — keeps UI clean.
			const showSubsetPicker = subsets.length > 1;
			return (
				<div className={b('session')} key={session.id}>
					<div>
						<Input value={session.name} onChange={(e) => updateSessionName(session.id, e.target.value)} />
					</div>
					<div className={b('bucket')}>
						<CubePicker
							cubeTypes={WCA_IMPORT_EVENTS}
							onChange={(ct) => updateSessionBucket(session.id, ct.id, null)}
							value={cubeType}
						/>
						{showSubsetPicker && (
							<SubsetPicker
								subsets={subsets}
								selectedSubset={subset}
								onChange={(s) => updateSessionBucket(session.id, cubeType, s)}
							/>
						)}
						{isMixed && (
							<span className={b('mixed-badge')}>
								{t('data_settings.mixed_session', { count: sessionBuckets.size })}
							</span>
						)}
					</div>
					<div className={b('actions-col')}>
						{isMixed && (
							<Button
								small
								secondary
								text={t('data_settings.split_session')}
								onClick={() => splitSession(session.id)}
							/>
						)}
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
						<div className={b('skipped')}>
							<strong>{t('data_settings.skipped_count', { count: data.skippedSolveCount })}</strong>
							{data.skippedCubeTypes && (
								<ul>
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
				<div className={b('actions')}>
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
				</div>
			</ImportSection>
		</div>
	);
}
