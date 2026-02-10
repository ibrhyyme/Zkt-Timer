import React, { ReactNode, useContext } from 'react';
import './ReviewImport.scss';
import block from '../../../../../styles/bem';
import { X } from 'phosphor-react';
import { ImportDataContext } from '../ImportData';
import Button from '../../../../common/button/Button';
import { toastError, toastSuccess, toastWarning } from '../../../../../util/toast';
import { importSessionsInChunks, importSolvesInChunks } from './chunked_import';
import ImportProgressDisplay from './progress_display/ImportProgressDisplay';
import ImportErrorSummary from './error_summary/ImportErrorSummary';
import ImportSection from '../import_section/ImportSection';
import { clearOfflineData } from '../../../../layout/offline';
import CubePicker from '../../../../common/cube_picker/CubePicker';
import Input from '../../../../common/inputs/input/Input';
import InputLegend from '../../../../common/inputs/input/input_legend/InputLegend';

const b = block('review-import');

export default function ReviewImport() {
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
				toastError(`Session import başarısız: ${sessionResult.failureCount} chunk hatası! Solve import'u iptal edildi.`);
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
				toastSuccess(`${data.sessions.length} sezon ve ${data.solves.length} çözüm başarıyla aktarıldı!`);
				setTimeout(() => {
					window.location.href = '/sessions';
				}, 1500);
			} else {
				// Partial failure - show error summary
				console.error('[Import] Some chunks failed:', combinedResults.errors);
				context.setImporting(false);
				toastError(`İçe aktarma başarısız: ${combinedResults.failureCount} chunk hatası!`);
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
		toastWarning('Başarısız chunk\'lar için dosyayı tekrar yükleyin');
		context.setImporting(false);
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

		const solves = [...data.solves];
		for (const solve of solves) {
			if (solve.session_id === sessionId) {
				solve.cube_type = cubeType;
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
				<InputLegend large text="Sezon İsmi" />
				<InputLegend large text="Cube Type" />
				<InputLegend large text="Remove" />
			</div>
		);
	}

	return (
		<div className={b()}>
			<hr />
			<ImportSection
				title="İncele ve içe aktar"
				description="Aşağıdaki sayıların doğru olduğundan emin olun. Ardından verileri içe aktarın!"
			>
				<div className={b('stats')}>
					<h4>
						Çözümler: <span>{data.solves.length.toLocaleString()}</span>
					</h4>
					<h4>
						Sezons: <span>{data.sessions.length.toLocaleString()}</span>
					</h4>
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
						? `İçe aktarılıyor... %${context.importProgress.percentComplete}`
						: "İçe aktar"
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
