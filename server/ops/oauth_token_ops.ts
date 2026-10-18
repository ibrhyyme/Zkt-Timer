/**
 * Pure logic behind server/ops/oauth-tokens.ts, the one-off tool that
 * neutralises the WCA / ZKT OAuth tokens exposed by the GraphQL leak (B-11).
 *
 * Everything that talks to the database or a provider is injected through
 * OpsDeps, so the whole run (argument parsing, ordering, resume, verification,
 * failure handling, and the promise that no token value is ever printed) is
 * covered by Jest without a network or a database.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {format} from 'util';

export type OpsCommand = 'report' | 'rotate' | 'revoke';
export type OpsService = 'wca' | 'zkt';

export interface OpsArgs {
	command: OpsCommand;
	service: OpsService | null;
	apply: boolean;
	onlyUnexpired: boolean;
	limit: number | null;
	delayMs: number;
	stateFile: string | null;
}

/**
 * Minimum gap between two provider requests. The federation shares one
 * 60-per-minute budget per IP across the token and userinfo endpoints, and the
 * Zkt Timer server is a single IP, so ZKT stays well under half of it to leave
 * room for real logins running at the same time.
 */
export const DEFAULT_DELAY_MS: Record<OpsService, number> = {wca: 1000, zkt: 2500};
export const MIN_DELAY_MS = 250;
export const RATE_LIMIT_WAIT_MS = 60_000;
export const MAX_CONSECUTIVE_TRANSIENT = 5;
/** An old access token with less life than this proves nothing when it is rejected. */
export const VERIFY_MIN_REMAINING_MS = 60_000;

export const USAGE = [
	'Kullanım (production container içinde):',
	'  node server/ops/oauth-tokens.js report',
	'  node server/ops/oauth-tokens.js rotate --service wca|zkt [--apply] [--only-unexpired] [--limit N] [--delay-ms N] [--state-file YOL]',
	'  node server/ops/oauth-tokens.js revoke --service wca [--apply] [--limit N] [--delay-ms N] [--state-file YOL]',
	'',
	'--apply olmadan rotate ve revoke sadece sayar, hiçbir şey yazmaz ve dışarıya istek atmaz.',
].join('\n');

export class OpsArgsError extends Error {}

const BOOLEAN_FLAGS = new Set(['apply', 'only-unexpired']);
const VALUE_FLAGS = new Set(['service', 'limit', 'delay-ms', 'state-file']);

function positiveInt(raw: string | undefined, flag: string): number {
	if (raw === undefined || !/^\d+$/.test(raw) || Number(raw) <= 0) {
		throw new OpsArgsError(`--${flag} pozitif bir tam sayı olmalı.`);
	}
	return Number(raw);
}

export function defaultStateFile(command: OpsCommand, service: OpsService): string {
	return path.join(os.tmpdir(), 'zkt-oauth-ops', `${command}-${service}.jsonl`);
}

/**
 * Strict on purpose: a typo such as `--aply` must fail loudly rather than run a
 * silent dry run that the operator mistakes for the real thing.
 */
export function parseOpsArgs(argv: string[]): OpsArgs {
	const [command, ...rest] = argv;
	if (command !== 'report' && command !== 'rotate' && command !== 'revoke') {
		throw new OpsArgsError(`Komut report, rotate ya da revoke olmalı.\n\n${USAGE}`);
	}

	const values: Record<string, string> = {};
	const booleans = new Set<string>();
	for (let i = 0; i < rest.length; i++) {
		const token = rest[i];
		if (!token.startsWith('--')) throw new OpsArgsError(`Beklenmeyen argüman: ${token}`);
		const eq = token.indexOf('=');
		const name = token.slice(2, eq >= 0 ? eq : undefined);
		if (BOOLEAN_FLAGS.has(name)) {
			if (eq >= 0) throw new OpsArgsError(`--${name} değer almaz.`);
			booleans.add(name);
			continue;
		}
		if (!VALUE_FLAGS.has(name)) throw new OpsArgsError(`Bilinmeyen seçenek: --${name}\n\n${USAGE}`);
		const value = eq >= 0 ? token.slice(eq + 1) : rest[++i];
		if (value === undefined || value === '' || value.startsWith('--')) {
			throw new OpsArgsError(`--${name} bir değer ister.`);
		}
		values[name] = value;
	}

	if (command === 'report') {
		const extra = [...booleans, ...Object.keys(values)];
		if (extra.length > 0) {
			throw new OpsArgsError(`report salt okunur ve seçenek almaz (verilen: ${extra.map((f) => `--${f}`).join(', ')}).`);
		}
		return {command, service: null, apply: false, onlyUnexpired: false, limit: null, delayMs: 0, stateFile: null};
	}

	const service = values.service;
	if (service !== 'wca' && service !== 'zkt') {
		throw new OpsArgsError(`${command} için --service wca ya da --service zkt gerekli.`);
	}
	if (command === 'revoke' && service === 'zkt') {
		throw new OpsArgsError(
			'ZKT jetonları federasyon tarafında iptal edilir: zekakuputurkiye-site deposundaki ' +
				'scripts/expire-oauth-access-tokens.ts. Zkt Timer tarafında ZKT için sadece rotate var.'
		);
	}
	if (command === 'revoke' && booleans.has('only-unexpired')) {
		throw new OpsArgsError('--only-unexpired sadece rotate ile kullanılır.');
	}

	const delayMs = values['delay-ms'] !== undefined ? positiveInt(values['delay-ms'], 'delay-ms') : DEFAULT_DELAY_MS[service];
	if (delayMs < MIN_DELAY_MS) {
		throw new OpsArgsError(`--delay-ms en az ${MIN_DELAY_MS} olmalı (sağlayıcının hız sınırına takılmamak için).`);
	}

	return {
		command,
		service,
		apply: booleans.has('apply'),
		onlyUnexpired: booleans.has('only-unexpired'),
		limit: values.limit !== undefined ? positiveInt(values.limit, 'limit') : null,
		delayMs,
		stateFile: values['state-file'] ?? defaultStateFile(command, service),
	};
}

export function chunk<T>(items: T[], size: number): T[][] {
	if (!Number.isInteger(size) || size <= 0) throw new Error('chunk size must be a positive integer');
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

export const REDACTED = '[REDACTED]';
const MIN_SECRET_LENGTH = 8;

/**
 * Removes every registered secret value, plus anything shaped like a bearer
 * header or a token / secret field, from a line of output. Values are
 * registered as soon as the tool loads them, before anything can print them.
 */
export class SecretRedactor {
	private readonly secrets = new Set<string>();

	add(...values: Array<string | null | undefined>): void {
		for (const value of values) {
			if (typeof value === 'string' && value.length >= MIN_SECRET_LENGTH) this.secrets.add(value);
		}
	}

	redact(text: string): string {
		let out = text;
		// Longest first, so a secret that contains another is removed whole.
		const ordered = [...this.secrets].sort((a, b) => b.length - a.length);
		for (const secret of ordered) out = out.split(secret).join(REDACTED);
		out = out.replace(/(Bearer\s+)(?!\[REDACTED\])[^\s"',}]+/gi, `$1${REDACTED}`);
		out = out.replace(
			/((?:access_token|refresh_token|auth_token|client_secret|token)['"]?\s*(?:=>|[:=])\s*['"]?)(?!\[REDACTED\])[^\s'"&,}]+/gi,
			`$1${REDACTED}`
		);
		return out;
	}
}

type ConsoleLike = Pick<Console, 'log' | 'info' | 'warn' | 'error' | 'debug'>;
const CONSOLE_METHODS: Array<keyof ConsoleLike> = ['log', 'info', 'warn', 'error', 'debug'];

/**
 * Routes every console call in the process through the redactor. The tool
 * reuses server code that logs on its own (the WCA exchange logs request
 * details and provider error bodies), so redacting only the tool's own lines
 * would not be enough. Returns a function that restores the originals.
 */
export function installConsoleRedaction(redactor: SecretRedactor, target: ConsoleLike = console): () => void {
	const originals = CONSOLE_METHODS.map((name) => [name, target[name]] as const);
	for (const [name, original] of originals) {
		target[name] = (...args: unknown[]) => original.call(target, redactor.redact(format(...args)));
	}
	return () => {
		for (const [name, original] of originals) target[name] = original;
	};
}

// ---------------------------------------------------------------------------
// Failure classification and pacing
// ---------------------------------------------------------------------------

export type FailureKind = 'dead_grant' | 'client_rejected' | 'rate_limited' | 'transient' | 'unexpected';

/**
 * Reads the `status` / `oauthError` that getOAuthPostRequest and the ZKT
 * postToken attach to their errors.
 *  - dead_grant: the refresh token no longer works. The integration is dead
 *    anyway; marking it revoked only tells the truth.
 *  - client_rejected: our client id / secret is wrong. Every row would fail the
 *    same way, so the run stops instead of marking everybody dead.
 *  - unexpected: some other 4xx. Also stops: guessing here could cost users
 *    their link.
 *  - transient: network or 5xx. The row is left as it was for the next run.
 */
export function classifyOAuthFailure(err: any): FailureKind {
	const message = typeof err?.message === 'string' ? err.message : '';
	const code: string | undefined =
		typeof err?.oauthError === 'string' ? err.oauthError : /^[a-z_]+$/.test(message) ? message : undefined;
	const status: unknown = typeof err?.status === 'number' ? err.status : err?.response?.status;

	if (code === 'invalid_grant') return 'dead_grant';
	if (code === 'invalid_client' || code === 'unauthorized_client') return 'client_rejected';
	if (status === 429 || code === 'rate_limited') return 'rate_limited';
	if (typeof status === 'number' && status >= 400 && status < 500) return 'unexpected';
	return 'transient';
}

export interface Clock {
	now(): number;
	sleep(ms: number): Promise<void>;
}

export const realClock: Clock = {
	now: () => Date.now(),
	sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** Enforces a minimum interval between consecutive provider requests. */
export function createPacer(minIntervalMs: number, clock: Clock = realClock): () => Promise<void> {
	let last = Number.NEGATIVE_INFINITY;
	return async () => {
		const wait = last + minIntervalMs - clock.now();
		if (wait > 0) await clock.sleep(wait);
		last = clock.now();
	};
}

// ---------------------------------------------------------------------------
// Resume state
// ---------------------------------------------------------------------------

/** Results that finish a row. A transient failure is retried on the next run. */
const FINAL_RESULTS = new Set(['rotated', 'dead_grant', 'revoked']);

export interface StateStore {
	readonly done: Set<string>;
	readonly verified: boolean;
	record(id: string, result: string): void;
	markVerified(): void;
}

/**
 * Append-only JSON-lines file of finished rows, so an interrupted run resumes
 * where it stopped. Holds integration ids and outcomes only, never a token. In
 * a dry run it is read but never written. Losing the file (container
 * restarted) only costs repeated work: rotating an already rotated row again
 * is harmless.
 */
export function openStateStore(file: string | null, writable: boolean): StateStore {
	const done = new Set<string>();
	let verified = false;

	if (file && fs.existsSync(file)) {
		for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
			if (!line.trim()) continue;
			try {
				const entry = JSON.parse(line);
				if (entry?.kind === 'verified') verified = true;
				if (entry?.kind === 'row' && typeof entry.id === 'string' && FINAL_RESULTS.has(entry.result)) {
					done.add(entry.id);
				}
			} catch {
				// A torn last line from a killed run: skip it, the row is simply redone.
			}
		}
	}

	const append = (entry: object) => {
		if (!writable || !file) return;
		fs.mkdirSync(path.dirname(file), {recursive: true});
		fs.appendFileSync(file, JSON.stringify({...entry, at: new Date().toISOString()}) + '\n');
	};

	return {
		done,
		get verified() {
			return verified;
		},
		record(id, result) {
			if (FINAL_RESULTS.has(result)) done.add(id);
			append({kind: 'row', id, result});
		},
		markVerified() {
			verified = true;
			append({kind: 'verified'});
		},
	};
}

/**
 * One applying run per service. `docker exec` without a TTY does not forward
 * Ctrl-C, so an operator who "stops" a run and starts it again would otherwise
 * have two runs spending the same refresh tokens; on the federation a reused
 * refresh token revokes the member's whole grant. Holds the pid; a lock whose
 * process is gone (killed with SIGKILL, say) is taken over.
 */
export function acquireRunLock(
	file: string,
	pid: number,
	isRunning: (pid: number) => boolean
): () => void {
	fs.mkdirSync(path.dirname(file), {recursive: true});
	try {
		fs.writeFileSync(file, String(pid), {flag: 'wx'});
	} catch (err: any) {
		if (err?.code !== 'EEXIST') throw err;
		const holder = Number(fs.readFileSync(file, 'utf8').trim());
		if (Number.isInteger(holder) && holder > 0 && holder !== pid && isRunning(holder)) {
			throw new OpsArgsError(
				`Başka bir çalıştırma sürüyor (pid ${holder}, kilit ${file}). Durdurmak için: kill -TERM ${holder} ` +
					'(o anki satırı bitirip çıkar).'
			);
		}
		fs.writeFileSync(file, String(pid));
	}
	return () => {
		try {
			if (fs.readFileSync(file, 'utf8').trim() === String(pid)) fs.unlinkSync(file);
		} catch {
			// Already gone.
		}
	};
}

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

export interface Candidate {
	id: string;
	authExpiresAt: number;
}

/**
 * Rows still to do, those with a live access token first: they are the ones
 * an attacker could use right now, and the first of them is where the
 * rotation is verified.
 */
export function selectCandidates(
	all: Candidate[],
	opts: {done: Set<string>; onlyUnexpired: boolean; limit: number | null; nowMs: number}
): Candidate[] {
	const pending = all.filter((c) => !opts.done.has(c.id) && (!opts.onlyUnexpired || c.authExpiresAt > opts.nowMs));
	pending.sort((a, b) => {
		const aLive = a.authExpiresAt > opts.nowMs ? 0 : 1;
		const bLive = b.authExpiresAt > opts.nowMs ? 0 : 1;
		if (aLive !== bLive) return aLive - bLive;
		return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
	});
	return opts.limit ? pending.slice(0, opts.limit) : pending;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export interface TokenRow {
	id: string;
	accessToken: string;
	refreshToken: string;
	authExpiresAt: number;
	/** The database row, handed back to the server code that refreshes it. */
	raw: unknown;
}

export interface OpsDeps {
	/** Rows a run may touch. Never carries token values. */
	listCandidates(opts: {requireRefresh: boolean}): Promise<Candidate[]>;
	loadRow(id: string): Promise<TokenRow | null>;
	/** Refresh grant through the existing server path, storing the new pair. Returns the new access token. */
	refresh(row: TokenRow): Promise<string>;
	/** HTTP status of a cheap authenticated call (WCA /me, ZKT userinfo); 0 on network error. */
	probe(accessToken: string): Promise<number>;
	/** RFC 7009 revocation with client credentials. */
	revokeRemote(token: string): Promise<void>;
	/**
	 * Writes revoked_at only while the row still holds the refresh token this run
	 * loaded. Returns false when somebody else (the app, the nightly WCA backfill,
	 * a second run of this tool) refreshed the row in the meantime: the
	 * invalid_grant then means "spent by them", not "dead", and the link is alive.
	 */
	markRevoked(row: TokenRow): Promise<boolean>;
	/** True once the operator asked the run to stop (SIGINT / SIGTERM). Checked between rows. */
	shouldStop?(): boolean;
	pace(): Promise<void>;
	clock: Clock;
	log(line: string): void;
	redactor: SecretRedactor;
	state: StateStore;
	/**
	 * WCA runs Doorkeeper. If it is configured with
	 * revoke_previous_refresh_token_on_use, the previous token row is only
	 * revoked once the NEW access token is used, so every rotated row makes one
	 * call with its new token.
	 */
	touchNewToken: boolean;
}

export type VerificationState = 'pending' | 'passed' | 'already' | 'not_needed' | 'failed' | 'inconclusive' | 'skipped';

export interface OpsSummary {
	command: 'rotate' | 'revoke';
	service: OpsService;
	apply: boolean;
	candidates: number;
	liveAccessTokens: number;
	alreadyDone: number;
	selected: number;
	processed: number;
	rotated: number;
	revoked: number;
	deadGrants: number;
	failed: number;
	skipped: number;
	newTokenProbeFailed: number;
	estimatedRequests: number;
	verification: VerificationState;
	aborted: string | null;
	exitCode: number;
}

export const FALLBACK_TEXT = [
	'YEDEK YOL: WCA rotasyonu eski access tokenı öldürmüyor.',
	'  1. Kuru çalıştır: node server/ops/oauth-tokens.js revoke --service wca',
	'  2. Uygula:        node server/ops/oauth-tokens.js revoke --service wca --apply',
	'  Her aktif WCA bağlantısının access ve refresh tokenı WCA tarafında iptal edilir, revoked_at yazılır.',
	'  Kullanıcı WCA ile yeniden giriş yapınca ya da bağlantıyı kaldırıp yeniden bağlayınca düzelir.',
].join('\n');

class AbortRun extends Error {
	constructor(readonly reason: string, readonly exitCode = 1) {
		super(reason);
	}
}

/** Requests per row, used only for the dry-run estimate. */
function requestsPerRow(command: 'rotate' | 'revoke', touchNewToken: boolean): number {
	if (command === 'revoke') return 2;
	return touchNewToken ? 2 : 1;
}

export async function runTokenOps(args: OpsArgs, deps: OpsDeps): Promise<OpsSummary> {
	if (args.command === 'report' || !args.service) throw new Error('runTokenOps handles rotate and revoke only');
	const command = args.command;
	const say = (line: string) => deps.log(deps.redactor.redact(line));
	const nowMs = deps.clock.now();

	const all = await deps.listCandidates({requireRefresh: command === 'rotate'});
	const selected = selectCandidates(all, {
		done: deps.state.done,
		onlyUnexpired: args.onlyUnexpired,
		limit: args.limit,
		nowMs,
	});

	const summary: OpsSummary = {
		command,
		service: args.service,
		apply: args.apply,
		candidates: all.length,
		liveAccessTokens: all.filter((c) => c.authExpiresAt > nowMs).length,
		alreadyDone: all.filter((c) => deps.state.done.has(c.id)).length,
		selected: selected.length,
		processed: 0,
		rotated: 0,
		revoked: 0,
		deadGrants: 0,
		failed: 0,
		skipped: 0,
		newTokenProbeFailed: 0,
		estimatedRequests: selected.length * requestsPerRow(command, deps.touchNewToken) + (command === 'rotate' ? 1 : 0),
		verification: command === 'revoke' ? 'skipped' : deps.state.verified ? 'already' : 'pending',
		aborted: null,
		exitCode: 0,
	};

	if (!args.apply) return summary;

	let consecutiveTransient = 0;

	// One provider call, with a single wait-and-retry on 429.
	const withRateLimitRetry = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
		await deps.pace();
		try {
			return await fn();
		} catch (err) {
			if (classifyOAuthFailure(err) !== 'rate_limited') throw err;
			say(`  ${label}: hız sınırı (429), ${RATE_LIMIT_WAIT_MS / 1000} sn bekleniyor`);
			await deps.clock.sleep(RATE_LIMIT_WAIT_MS);
			await deps.pace();
			return await fn();
		}
	};

	const handleFailure = async (row: TokenRow, err: unknown, stage: string) => {
		const kind = classifyOAuthFailure(err);
		const status = (err as any)?.status ?? '-';
		const code = (err as any)?.oauthError ?? '-';
		if (kind === 'dead_grant' && command === 'rotate') {
			if (!(await deps.markRevoked(row))) {
				// Not final: the next run looks at the row again with its current tokens.
				deps.state.record(row.id, 'changed_elsewhere');
				summary.skipped++;
				consecutiveTransient = 0;
				say(`  ${row.id}: refresh token bu arada başka yerden yenilenmiş; revoked_at yazılmadı, bağlantı çalışıyor`);
				return;
			}
			deps.state.record(row.id, 'dead_grant');
			summary.deadGrants++;
			consecutiveTransient = 0;
			say(`  ${row.id}: refresh token zaten ölü (invalid_grant), revoked_at yazıldı`);
			return;
		}
		if (kind === 'client_rejected' || kind === 'unexpected' || kind === 'rate_limited' || kind === 'dead_grant') {
			throw new AbortRun(
				`${row.id} ${stage}: sağlayıcı reddetti (status=${status}, error=${code}). ` +
					'İstemci kimliği ya da sırrı yanlış olabilir; tüm satırlar aynı şekilde düşeceği için durduruldu.'
			);
		}
		summary.failed++;
		consecutiveTransient++;
		deps.state.record(row.id, 'transient_error');
		say(`  ${row.id} ${stage}: geçici hata (status=${status}), satır olduğu gibi bırakıldı`);
		if (consecutiveTransient >= MAX_CONSECUTIVE_TRANSIENT) {
			throw new AbortRun(`Art arda ${MAX_CONSECUTIVE_TRANSIENT} geçici hata: sağlayıcı erişilemiyor olabilir.`);
		}
	};

	try {
		for (const [batchIndex, batch] of chunk(selected, 50).entries()) {
			say(`Parti ${batchIndex + 1}/${Math.ceil(selected.length / 50)} (${batch.length} satır)`);
			for (const candidate of batch) {
				if (deps.shouldStop?.()) {
					throw new AbortRun('Durdurma isteği alındı; yarım satır yok, kalanlar aynı komutla devam eder.', 130);
				}
				const row = await deps.loadRow(candidate.id);
				if (!row) {
					summary.skipped++;
					continue;
				}
				deps.redactor.add(row.accessToken, row.refreshToken);
				summary.processed++;

				if (command === 'revoke') {
					try {
						await withRateLimitRetry('revoke access', () => deps.revokeRemote(row.accessToken));
						if (row.refreshToken) {
							await withRateLimitRetry('revoke refresh', () => deps.revokeRemote(row.refreshToken));
						}
					} catch (err) {
						await handleFailure(row, err, 'revoke');
						continue;
					}
					if (!(await deps.markRevoked(row))) {
						say(`  ${row.id}: WCA tarafında iptal edildi; satır bu arada yenilendiği için revoked_at yazılmadı`);
					}
					deps.state.record(row.id, 'revoked');
					summary.revoked++;
					consecutiveTransient = 0;
					continue;
				}

				// rotate
				const oldAccess = row.accessToken;
				const oldRefresh = row.refreshToken;
				const oldStillLive = row.authExpiresAt > deps.clock.now() + VERIFY_MIN_REMAINING_MS;

				let newAccess: string;
				try {
					newAccess = await withRateLimitRetry('refresh', () => deps.refresh(row));
				} catch (err) {
					await handleFailure(row, err, 'refresh');
					continue;
				}
				deps.redactor.add(newAccess);
				deps.state.record(row.id, 'rotated');
				summary.rotated++;
				consecutiveTransient = 0;

				if (deps.touchNewToken) {
					await deps.pace();
					const status = await deps.probe(newAccess);
					if (status !== 200) {
						summary.newTokenProbeFailed++;
						say(`  ${row.id}: yeni token ile /me ${status || 'ağ hatası'} döndü (rotasyon kaydedildi)`);
					}
				}

				if (summary.verification === 'pending' && oldStillLive) {
					await deps.pace();
					const status = await deps.probe(oldAccess);
					if (status === 401) {
						summary.verification = 'passed';
						deps.state.markVerified();
						say(`  Doğrulama (${row.id}): eski access token artık reddediliyor (401). Devam ediliyor.`);
					} else if (status === 200) {
						summary.verification = 'failed';
						say(`  Doğrulama (${row.id}): ESKİ ACCESS TOKEN HÂLÂ ÇALIŞIYOR (200).`);
						for (const [label, token] of [
							['eski access', oldAccess],
							['eski refresh', oldRefresh],
						] as const) {
							if (!token) continue;
							try {
								await withRateLimitRetry(`revoke ${label}`, () => deps.revokeRemote(token));
								say(`  Doğrulama satırının ${label} tokenı RFC 7009 ile iptal edildi.`);
							} catch (err) {
								say(`  Doğrulama satırının ${label} tokenı iptal EDİLEMEDİ (status=${(err as any)?.status ?? '-'}).`);
							}
						}
						throw new AbortRun('Rotasyon eski tokenı öldürmüyor.\n' + FALLBACK_TEXT, 2);
					} else {
						summary.verification = 'inconclusive';
						throw new AbortRun(
							`Doğrulama sonuçsuz (eski token ile /me ${status || 'ağ hatası'} döndü). ` +
								'Rotasyon kaydedildi; birkaç dakika sonra aynı komutu tekrar çalıştır, doğrulama bir sonraki canlı satırda yapılır.'
						);
					}
				}
			}
		}
	} catch (err) {
		if (!(err instanceof AbortRun)) throw err;
		summary.aborted = err.reason;
		summary.exitCode = err.exitCode;
	}

	if (summary.verification === 'pending') summary.verification = 'not_needed';
	return summary;
}

const VERIFICATION_TEXT: Record<VerificationState, string> = {
	pending: 'yapılmadı',
	passed: 'GEÇTİ: eski access token reddediliyor',
	already: 'daha önceki bir çalıştırmada geçti',
	not_needed: 'gerekmedi: süresi dolmamış eski access token kalmadı',
	failed: 'KALDI: eski access token hâlâ çalışıyor',
	inconclusive: 'sonuçsuz, tekrar çalıştır',
	skipped: 'revoke modunda yapılmaz',
};

export function formatSummary(s: OpsSummary, delayMs: number): string {
	const lines = [
		'',
		`=== ${s.command} ${s.service} ${s.apply ? '(UYGULANDI)' : '(KURU ÇALIŞTIRMA, hiçbir şey yazılmadı)'} ===`,
		`Aday satır                         : ${s.candidates}`,
		`  süresi dolmamış access token     : ${s.liveAccessTokens}`,
		`  önceki çalıştırmada bitmiş       : ${s.alreadyDone}`,
		`Bu çalıştırmanın seçtiği           : ${s.selected}`,
	];
	if (!s.apply) {
		const minutes = Math.ceil((s.estimatedRequests * delayMs) / 60000);
		lines.push(`Tahmini istek / süre               : ${s.estimatedRequests} istek, yaklaşık ${minutes} dk`);
		lines.push('Uygulamak için aynı komutu --apply ile çalıştır.');
		return lines.join('\n');
	}
	lines.push(
		`İşlenen                            : ${s.processed}`,
		s.command === 'rotate' ? `Döndürülen                         : ${s.rotated}` : `İptal edilen                       : ${s.revoked}`,
		`Ölü grant (revoked_at yazıldı)     : ${s.deadGrants}`,
		`Geçici hata (dokunulmadı)          : ${s.failed}`,
		`Atlanan (satır yok / bu arada yenilenmiş): ${s.skipped}`
	);
	if (s.command === 'rotate') {
		lines.push(`Yeni token ile /me başarısız       : ${s.newTokenProbeFailed}`);
		lines.push(`Doğrulama                          : ${VERIFICATION_TEXT[s.verification]}`);
	}
	if (s.aborted) lines.push('', `DURDURULDU: ${s.aborted}`);
	else if (s.failed > 0) lines.push('', 'Geçici hatalı satırlar için aynı komutu tekrar çalıştır; bitmiş satırlar atlanır.');
	return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface ReportRow {
	service_name: string;
	rows: number;
	active: number;
	active_with_refresh: number;
	access_still_valid: number;
	access_still_valid_active: number;
	latest_expiry: number | null;
}

export function formatReport(rows: ReportRow[], nowMs: number): string {
	if (rows.length === 0) return 'integration tablosu boş.';
	const lines = ['service | satır | aktif | aktif+refresh | access geçerli (hepsi) | access geçerli (aktif) | en geç bitiş'];
	for (const r of rows) {
		let latest = '-';
		if (r.latest_expiry && r.latest_expiry > nowMs) {
			const hours = ((r.latest_expiry - nowMs) / 3_600_000).toFixed(1);
			latest = `${new Date(r.latest_expiry).toISOString()} (${hours} saat sonra)`;
		} else if (r.latest_expiry) {
			latest = 'hepsi dolmuş';
		}
		lines.push(
			[
				r.service_name,
				r.rows,
				r.active,
				r.active_with_refresh,
				r.access_still_valid,
				r.access_still_valid_active,
				latest,
			].join(' | ')
		);
	}
	return lines.join('\n');
}
