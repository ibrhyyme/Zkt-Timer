/**
 * One-off OAuth token operations after the GraphQL token leak (B-11).
 * Runbook: .feedback/reports/token-rotation-runbook.md
 *
 * Lives under server/ so the deploy compiles it into the image
 * (/app/server/ops/oauth-tokens.js); scripts/ never reaches production.
 *
 *   node server/ops/oauth-tokens.js report
 *   node server/ops/oauth-tokens.js rotate --service wca|zkt [--apply] [--only-unexpired] [--limit N]
 *   node server/ops/oauth-tokens.js revoke --service wca [--apply] [--limit N]
 *
 * Nothing is written and no provider is contacted without --apply. Token
 * values are never printed: every console line goes through a redactor that
 * knows each token the run has loaded and the client secrets.
 *
 * The refresh goes through the app's own code (getNewAuthToken for WCA,
 * rotateZktIntegrationTokens for ZKT), so the stored row looks exactly like a
 * normal refresh would leave it.
 */
import 'reflect-metadata';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import {getPrisma, initPrisma} from '../database';
import {initSearch} from '../services/search';
import {initLogger} from '../services/logger';
import {LINKED_SERVICES} from '../../shared/integration';
import {getNewAuthToken, getOAuthPostRequest} from '../integrations/oauth';
import {revokeZktGrant, rotateZktIntegrationTokens} from '../integrations/zkt_oauth';
import {
	Candidate,
	OpsArgs,
	OpsArgsError,
	OpsDeps,
	OpsService,
	ReportRow,
	SecretRedactor,
	TokenRow,
	acquireRunLock,
	createPacer,
	formatReport,
	formatSummary,
	installConsoleRedaction,
	openStateStore,
	parseOpsArgs,
	realClock,
	runTokenOps,
} from './oauth_token_ops';

let stopRequested = false;

/** Is `pid` alive and still this tool (a recycled pid must not hold the lock)? */
function isOpsProcessRunning(pid: number): boolean {
	try {
		process.kill(pid, 0);
	} catch (err: any) {
		if (err?.code !== 'EPERM') return false;
	}
	try {
		return fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes('oauth-tokens');
	} catch {
		// No /proc (not Linux): trust the signal check.
		return true;
	}
}

async function report(): Promise<void> {
	const nowMs = Date.now();
	const rows: any[] = await getPrisma().$queryRaw`
		SELECT service_name,
		       count(*)::int AS rows,
		       count(*) FILTER (WHERE revoked_at IS NULL)::int AS active,
		       count(*) FILTER (WHERE revoked_at IS NULL AND refresh_token <> '')::int AS active_with_refresh,
		       count(*) FILTER (WHERE auth_expires_at > ${BigInt(nowMs)})::int AS access_still_valid,
		       count(*) FILTER (WHERE revoked_at IS NULL AND auth_expires_at > ${BigInt(nowMs)})::int AS access_still_valid_active,
		       max(auth_expires_at) AS latest_expiry
		FROM integration
		GROUP BY service_name
		ORDER BY service_name`;
	const normalized: ReportRow[] = rows.map((r) => ({
		service_name: String(r.service_name),
		rows: Number(r.rows),
		active: Number(r.active),
		active_with_refresh: Number(r.active_with_refresh),
		access_still_valid: Number(r.access_still_valid),
		access_still_valid_active: Number(r.access_still_valid_active),
		latest_expiry: r.latest_expiry == null ? null : Number(r.latest_expiry),
	}));
	console.log(`Ölçüm zamanı: ${new Date(nowMs).toISOString()} (salt okuma, hiçbir şey yazılmadı)`);
	console.log(formatReport(normalized, nowMs));
}

/** Status of an authenticated GET; 0 when the request never got an answer. */
async function probeStatus(url: string, accessToken: string): Promise<number> {
	try {
		const res = await axios.get(url, {
			headers: {Authorization: `Bearer ${accessToken}`},
			timeout: 15000,
			validateStatus: () => true,
		});
		return res.status;
	} catch {
		// The error object carries the Authorization header; it is never logged.
		return 0;
	}
}

function buildDeps(args: OpsArgs, service: OpsService, redactor: SecretRedactor): OpsDeps {
	const prisma = getPrisma();
	const linked = LINKED_SERVICES[service];

	return {
		async listCandidates({requireRefresh}): Promise<Candidate[]> {
			const now = BigInt(Date.now());
			// Active rows, plus locally revoked rows whose access token has not run
			// out yet: a token leaked from such a row still works at the provider.
			const rows = await prisma.integration.findMany({
				where: {
					service_name: service,
					...(requireRefresh ? {refresh_token: {not: ''}} : {}),
					OR: [{revoked_at: null}, {auth_expires_at: {gt: now}}],
				},
				select: {id: true, auth_expires_at: true},
				orderBy: {id: 'asc'},
			});
			return rows.map((r) => ({id: r.id, authExpiresAt: Number(r.auth_expires_at)}));
		},

		async loadRow(id): Promise<TokenRow | null> {
			// Loaded one at a time, right before use, so a row the app refreshed
			// in the meantime is rotated from its current tokens.
			const row = await prisma.integration.findUnique({where: {id}});
			if (!row || row.service_name !== service) return null;
			return {
				id: row.id,
				accessToken: row.auth_token,
				refreshToken: row.refresh_token,
				authExpiresAt: Number(row.auth_expires_at),
				raw: row,
			};
		},

		async refresh(row): Promise<string> {
			if (service === 'wca') {
				return getNewAuthToken(row.raw as any);
			}
			const tokens = await rotateZktIntegrationTokens(row.raw);
			return tokens.accessToken;
		},

		probe: (accessToken) => probeStatus(linked.meEndpoint, accessToken),

		async revokeRemote(token): Promise<void> {
			if (service === 'wca') {
				// Same call the app makes when a member unlinks WCA: RFC 7009 with
				// client_id + client_secret in the body.
				await getOAuthPostRequest(linked, linked.revokeEndpoint, {token});
				return;
			}
			await revokeZktGrant(token);
		},

		async markRevoked(row): Promise<boolean> {
			// Conditional on the refresh token this run loaded: an invalid_grant
			// caused by a concurrent refresh must not mark a working link dead.
			const res = await prisma.integration.updateMany({
				where: {id: row.id, refresh_token: row.refreshToken},
				data: {revoked_at: new Date()},
			});
			return res.count === 1;
		},

		shouldStop: () => stopRequested,

		pace: createPacer(args.delayMs),
		clock: realClock,
		log: (line) => console.log(line),
		redactor,
		state: openStateStore(args.stateFile, args.apply),
		touchNewToken: service === 'wca',
	};
}

async function main(): Promise<number> {
	const redactor = new SecretRedactor();
	redactor.add(process.env.WCA_CLIENT_SECRET, process.env.ZKT_SECRET, process.env.ZKT_INTERNAL_API_SECRET);
	installConsoleRedaction(redactor);

	let args: OpsArgs;
	try {
		args = parseOpsArgs(process.argv.slice(2));
	} catch (err) {
		if (err instanceof OpsArgsError) {
			console.error(err.message);
			return 64;
		}
		throw err;
	}

	initPrisma();
	if (args.command === 'report') {
		await report();
		return 0;
	}

	const service = args.service as OpsService;
	if (args.apply) {
		const secret = service === 'wca' ? process.env.WCA_CLIENT_SECRET : process.env.ZKT_SECRET;
		if (!secret) {
			console.error(`${service === 'wca' ? 'WCA_CLIENT_SECRET' : 'ZKT_SECRET'} tanımlı değil; refresh ve revoke çalışmaz. Durduruldu.`);
			return 1;
		}

		try {
			const release = acquireRunLock(
				path.join(path.dirname(args.stateFile as string), `${service}.lock`),
				process.pid,
				isOpsProcessRunning
			);
			process.on('exit', release);
		} catch (err) {
			if (err instanceof OpsArgsError) {
				console.error(err.message);
				return 75;
			}
			throw err;
		}
		// First signal: finish the row in flight, then stop (a refresh killed
		// between the provider's answer and the database write loses the grant).
		// Second signal: leave now.
		const onSignal = () => {
			if (stopRequested) process.exit(130);
			stopRequested = true;
			console.log('Durdurma isteği alındı: o anki satır bitince çıkılacak. Hemen çıkmak için tekrar gönder.');
		};
		process.on('SIGINT', onSignal);
		process.on('SIGTERM', onSignal);

		// zkt_oauth logs through winston, which must exist before the first
		// failure. Only an applying run reaches a provider, so a dry run opens no
		// Elasticsearch client at all.
		initSearch();
		initLogger();
	}

	console.log(
		`${args.command} ${service} ${args.apply ? 'UYGULANIYOR' : 'kuru çalıştırma'}` +
			` | istekler arası ${args.delayMs} ms | durum dosyası ${args.stateFile}`
	);
	const summary = await runTokenOps(args, buildDeps(args, service, redactor));
	console.log(formatSummary(summary, args.delayMs));
	return summary.exitCode;
}

if (require.main === module) {
	main()
		.catch((err) => {
			// Message only: an error object can carry request config with credentials.
			console.error('Beklenmeyen hata:', err?.message ?? String(err));
			return 1;
		})
		.then(async (code) => {
			await getPrisma()
				?.$disconnect()
				.catch(() => undefined);
			// The ES client and logger keep sockets open; leave explicitly.
			process.exit(code);
		});
}
