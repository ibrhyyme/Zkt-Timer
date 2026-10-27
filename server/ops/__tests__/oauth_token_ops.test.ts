import fs from 'fs';
import os from 'os';
import path from 'path';
import {
	Candidate,
	Clock,
	DEFAULT_DELAY_MS,
	OpsArgs,
	OpsArgsError,
	OpsDeps,
	RATE_LIMIT_WAIT_MS,
	REDACTED,
	SecretRedactor,
	TokenRow,
	acquireRunLock,
	chunk,
	classifyOAuthFailure,
	createPacer,
	defaultStateFile,
	formatReport,
	formatSummary,
	installConsoleRedaction,
	openStateStore,
	parseOpsArgs,
	runTokenOps,
	selectCandidates,
} from '../oauth_token_ops';

const NOW = Date.UTC(2026, 9, 6, 12, 0, 0);
const HOUR = 3_600_000;

describe('parseOpsArgs', () => {
	it('accepts report with no options and keeps it read-only', () => {
		expect(parseOpsArgs(['report'])).toEqual({
			command: 'report',
			service: null,
			apply: false,
			onlyUnexpired: false,
			limit: null,
			delayMs: 0,
			stateFile: null,
		});
	});

	it('refuses options on report, including --apply', () => {
		expect(() => parseOpsArgs(['report', '--apply'])).toThrow(OpsArgsError);
		expect(() => parseOpsArgs(['report', '--service', 'wca'])).toThrow(OpsArgsError);
	});

	it('defaults rotate to a dry run with the per-service delay and a state file', () => {
		const wca = parseOpsArgs(['rotate', '--service', 'wca']);
		expect(wca.apply).toBe(false);
		expect(wca.delayMs).toBe(DEFAULT_DELAY_MS.wca);
		expect(wca.stateFile).toBe(defaultStateFile('rotate', 'wca'));
		expect(parseOpsArgs(['rotate', '--service=zkt']).delayMs).toBe(DEFAULT_DELAY_MS.zkt);
	});

	it('reads every option in both spellings', () => {
		const args = parseOpsArgs([
			'rotate',
			'--service',
			'wca',
			'--apply',
			'--only-unexpired',
			'--limit=5',
			'--delay-ms',
			'2000',
			'--state-file',
			'/tmp/x.jsonl',
		]);
		expect(args).toEqual({
			command: 'rotate',
			service: 'wca',
			apply: true,
			onlyUnexpired: true,
			limit: 5,
			delayMs: 2000,
			stateFile: '/tmp/x.jsonl',
		});
	});

	it('fails loudly on a typo instead of silently dry-running', () => {
		expect(() => parseOpsArgs(['rotate', '--service', 'wca', '--aply'])).toThrow(/Bilinmeyen/);
		expect(() => parseOpsArgs(['rotate', 'wca'])).toThrow(OpsArgsError);
		expect(() => parseOpsArgs(['rotat', '--service', 'wca'])).toThrow(OpsArgsError);
	});

	it('requires a valid service and sends ZKT revocation to the federation', () => {
		expect(() => parseOpsArgs(['rotate'])).toThrow(/--service/);
		expect(() => parseOpsArgs(['rotate', '--service', 'discord'])).toThrow(/--service/);
		expect(() => parseOpsArgs(['revoke', '--service', 'zkt'])).toThrow(/federasyon/);
		expect(() => parseOpsArgs(['revoke', '--service', 'wca', '--only-unexpired'])).toThrow(OpsArgsError);
	});

	it('rejects bad numbers and a delay that would hammer the provider', () => {
		expect(() => parseOpsArgs(['rotate', '--service', 'wca', '--limit', '0'])).toThrow(/--limit/);
		expect(() => parseOpsArgs(['rotate', '--service', 'wca', '--limit', 'abc'])).toThrow(/--limit/);
		expect(() => parseOpsArgs(['rotate', '--service', 'wca', '--delay-ms', '10'])).toThrow(/--delay-ms/);
		expect(() => parseOpsArgs(['rotate', '--service', 'wca', '--limit'])).toThrow(/değer/);
		expect(() => parseOpsArgs(['rotate', '--service', 'wca', '--limit', '--apply'])).toThrow(/değer/);
	});
});

describe('chunk', () => {
	it('splits into fixed-size batches and keeps the remainder', () => {
		expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
		expect(chunk([], 3)).toEqual([]);
		expect(() => chunk([1], 0)).toThrow();
	});
});

describe('selectCandidates', () => {
	const rows: Candidate[] = [
		{id: 'c', authExpiresAt: NOW - HOUR},
		{id: 'b', authExpiresAt: NOW + HOUR},
		{id: 'a', authExpiresAt: NOW - HOUR},
		{id: 'd', authExpiresAt: NOW + 2 * HOUR},
	];

	it('puts live access tokens first, then id order', () => {
		const out = selectCandidates(rows, {done: new Set(), onlyUnexpired: false, limit: null, nowMs: NOW});
		expect(out.map((r) => r.id)).toEqual(['b', 'd', 'a', 'c']);
	});

	it('skips finished rows, honours --only-unexpired and --limit', () => {
		expect(
			selectCandidates(rows, {done: new Set(['b']), onlyUnexpired: true, limit: null, nowMs: NOW}).map((r) => r.id)
		).toEqual(['d']);
		expect(selectCandidates(rows, {done: new Set(), onlyUnexpired: false, limit: 3, nowMs: NOW}).map((r) => r.id)).toEqual([
			'b',
			'd',
			'a',
		]);
	});
});

describe('classifyOAuthFailure', () => {
	const err = (props: object) => Object.assign(new Error('x'), props);

	it('maps provider answers to the action the run takes', () => {
		expect(classifyOAuthFailure(err({status: 400, oauthError: 'invalid_grant'}))).toBe('dead_grant');
		expect(classifyOAuthFailure(err({status: 401, oauthError: 'invalid_client'}))).toBe('client_rejected');
		expect(classifyOAuthFailure(err({status: 400, oauthError: 'unauthorized_client'}))).toBe('client_rejected');
		expect(classifyOAuthFailure(err({status: 429}))).toBe('rate_limited');
		expect(classifyOAuthFailure(err({status: 429, oauthError: 'rate_limited'}))).toBe('rate_limited');
		expect(classifyOAuthFailure(err({status: 403}))).toBe('unexpected');
		expect(classifyOAuthFailure(err({status: 502}))).toBe('transient');
		expect(classifyOAuthFailure(new Error('socket hang up'))).toBe('transient');
	});

	it('falls back to an RFC error code carried as the message', () => {
		expect(classifyOAuthFailure(new Error('invalid_grant'))).toBe('dead_grant');
		expect(classifyOAuthFailure(new Error('ZKT token exchange failed'))).toBe('transient');
	});
});

function fakeClock(start = NOW): Clock & {slept: number[]; t: number} {
	const clock = {
		t: start,
		slept: [] as number[],
		now: () => clock.t,
		sleep: async (ms: number) => {
			clock.slept.push(ms);
			clock.t += ms;
		},
	};
	return clock;
}

describe('createPacer', () => {
	it('waits only for what is left of the interval', async () => {
		const clock = fakeClock();
		const pace = createPacer(1000, clock);
		await pace();
		expect(clock.slept).toEqual([]);
		clock.t += 300;
		await pace();
		expect(clock.slept).toEqual([700]);
		clock.t += 5000;
		await pace();
		expect(clock.slept).toEqual([700]);
	});
});

describe('redaction', () => {
	const ACCESS = 'wca-access-AAAAAAAAAAAAAAAAAAAA';
	const REFRESH = 'wca-refresh-RRRRRRRRRRRRRRRRRRRR';
	const SECRET = 'client-secret-SSSSSSSSSSSSSSSS';

	it('removes registered values and token-shaped fields', () => {
		const r = new SecretRedactor();
		r.add(ACCESS, REFRESH, SECRET, undefined, null, 'short');
		const out = r.redact(
			`a=${ACCESS} refresh_token=${REFRESH}&x=1 Bearer unknownTokenValue123 {"access_token":"zzzzzzzzzz"} ${SECRET}`
		);
		expect(out).not.toContain(ACCESS);
		expect(out).not.toContain(REFRESH);
		expect(out).not.toContain(SECRET);
		expect(out).not.toContain('unknownTokenValue123');
		expect(out).not.toContain('zzzzzzzzzz');
		expect(out).toContain(REDACTED);
		// Counters with "token" in their name are not touched.
		expect(r.redact('tokenFailed: 3')).toBe('tokenFailed: 3');
	});

	it('scrubs whatever reused server code prints through console, objects and errors included', () => {
		const r = new SecretRedactor();
		r.add(ACCESS, SECRET);
		const lines: string[] = [];
		const target: any = {
			log: (s: string) => lines.push(s),
			info: (s: string) => lines.push(s),
			warn: (s: string) => lines.push(s),
			error: (s: string) => lines.push(s),
			debug: (s: string) => lines.push(s),
		};
		const restore = installConsoleRedaction(r, target);

		const axiosLike: any = new Error('Request failed with status code 401');
		axiosLike.config = {
			headers: {Authorization: `Bearer ${ACCESS}`},
			data: new URLSearchParams({client_id: 'zkt-timer', client_secret: SECRET, refresh_token: REFRESH}),
		};
		target.error('createIntegration error:', axiosLike);
		target.log('details', {token: ACCESS, nested: {auth_token: ACCESS}});
		target.warn(`plain ${ACCESS}`);
		restore();
		target.log('after restore');

		const all = lines.join('\n');
		expect(lines).toHaveLength(4);
		for (const secret of [ACCESS, SECRET, REFRESH]) expect(all).not.toContain(secret);
		expect(lines[3]).toBe('after restore');
	});
});

describe('openStateStore', () => {
	let dir: string;
	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oauth-ops-'));
	});
	afterEach(() => {
		fs.rmSync(dir, {recursive: true, force: true});
	});

	it('resumes finished rows and the verification flag, ignoring a torn line', () => {
		const file = path.join(dir, 'nested', 'state.jsonl');
		const first = openStateStore(file, true);
		first.record('a', 'rotated');
		first.record('b', 'transient_error');
		first.record('c', 'dead_grant');
		first.markVerified();
		fs.appendFileSync(file, '{"kind":"row","id":"d","res');

		const second = openStateStore(file, true);
		expect([...second.done].sort()).toEqual(['a', 'c']);
		expect(second.verified).toBe(true);
		expect(fs.readFileSync(file, 'utf8')).not.toMatch(/token/i);
	});

	it('never writes in a dry run', () => {
		const file = path.join(dir, 'state.jsonl');
		const store = openStateStore(file, false);
		store.record('a', 'rotated');
		store.markVerified();
		expect(fs.existsSync(file)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// runTokenOps with fake dependencies
// ---------------------------------------------------------------------------

interface FakeRow {
	id: string;
	access: string;
	refresh: string;
	expiresAt: number;
}

function tok(kind: string, id: string, gen = 0) {
	return `${kind}-${id}-${gen}-${'x'.repeat(24)}`;
}

function makeWorld(opts: {
	rows: FakeRow[];
	refreshBehaviour?: (row: FakeRow, attempt: number) => Error | null;
	oldTokenStillWorks?: boolean;
	probeOverride?: (token: string) => number | null;
	revokeBehaviour?: (token: string) => Error | null;
	stateFile?: string | null;
	touchNewToken?: boolean;
}) {
	const clock = fakeClock();
	const db = new Map(opts.rows.map((r) => [r.id, {...r, revoked: false}]));
	const liveTokens = new Set<string>(opts.rows.map((r) => r.access));
	const everyToken = new Set<string>(opts.rows.flatMap((r) => [r.access, r.refresh]));
	const calls = {refresh: [] as string[], probe: [] as string[], revoke: [] as string[], markRevoked: [] as string[]};
	const attempts = new Map<string, number>();
	const lines: string[] = [];

	const deps: OpsDeps = {
		async listCandidates({requireRefresh}) {
			return [...db.values()]
				.filter((r) => (!requireRefresh || r.refresh) && (!r.revoked || r.expiresAt > clock.now()))
				.map((r) => ({id: r.id, authExpiresAt: r.expiresAt}));
		},
		async loadRow(id): Promise<TokenRow | null> {
			const r = db.get(id);
			if (!r) return null;
			return {id: r.id, accessToken: r.access, refreshToken: r.refresh, authExpiresAt: r.expiresAt, raw: r};
		},
		async refresh(row) {
			const r = db.get(row.id)!;
			calls.refresh.push(row.id);
			const n = (attempts.get(row.id) ?? 0) + 1;
			attempts.set(row.id, n);
			const failure = opts.refreshBehaviour?.(r, n);
			if (failure) throw failure;
			if (!opts.oldTokenStillWorks) liveTokens.delete(r.access);
			const gen = Number(r.access.split('-')[2]) + 1;
			r.access = tok('access', r.id, gen);
			r.refresh = tok('refresh', r.id, gen);
			r.expiresAt = clock.now() + 2 * HOUR;
			liveTokens.add(r.access);
			everyToken.add(r.access);
			everyToken.add(r.refresh);
			return r.access;
		},
		async probe(token) {
			calls.probe.push(token);
			const override = opts.probeOverride?.(token);
			if (override != null) return override;
			return liveTokens.has(token) ? 200 : 401;
		},
		async revokeRemote(token) {
			calls.revoke.push(token);
			const failure = opts.revokeBehaviour?.(token);
			if (failure) throw failure;
			liveTokens.delete(token);
		},
		async markRevoked(row) {
			calls.markRevoked.push(row.id);
			const r = db.get(row.id)!;
			// Same condition as the real updateMany: only while the loaded refresh token is still stored.
			if (r.refresh !== row.refreshToken) return false;
			r.revoked = true;
			return true;
		},
		pace: createPacer(1000, clock),
		clock,
		log: (line) => lines.push(line),
		redactor: new SecretRedactor(),
		state: openStateStore(opts.stateFile ?? null, true),
		touchNewToken: opts.touchNewToken ?? true,
	};

	const assertNoTokenPrinted = (extra: string[] = []) => {
		const text = [...lines, ...extra].join('\n');
		for (const t of everyToken) expect(text).not.toContain(t);
	};

	return {deps, db, calls, lines, clock, liveTokens, assertNoTokenPrinted};
}

const rowsFixture = (): FakeRow[] => [
	{id: 'r1', access: tok('access', 'r1'), refresh: tok('refresh', 'r1'), expiresAt: NOW - HOUR},
	{id: 'r2', access: tok('access', 'r2'), refresh: tok('refresh', 'r2'), expiresAt: NOW + HOUR},
	{id: 'r3', access: tok('access', 'r3'), refresh: tok('refresh', 'r3'), expiresAt: NOW + 2 * HOUR},
];

const rotateArgs = (over: Partial<OpsArgs> = {}): OpsArgs => ({
	command: 'rotate',
	service: 'wca',
	apply: true,
	onlyUnexpired: false,
	limit: null,
	delayMs: 1000,
	stateFile: null,
	...over,
});

describe('runTokenOps rotate', () => {
	it('dry run counts and touches nothing', async () => {
		const w = makeWorld({rows: rowsFixture()});
		const s = await runTokenOps(rotateArgs({apply: false}), w.deps);
		expect(s).toMatchObject({candidates: 3, liveAccessTokens: 2, selected: 3, processed: 0, estimatedRequests: 7});
		expect(w.calls).toEqual({refresh: [], probe: [], revoke: [], markRevoked: []});
		expect(formatSummary(s, 1000)).toMatch(/KURU/);
	});

	it('rotates every row, verifies on the first live one, and never prints a token', async () => {
		const w = makeWorld({rows: rowsFixture()});
		const s = await runTokenOps(rotateArgs(), w.deps);

		expect(s.exitCode).toBe(0);
		expect(s.rotated).toBe(3);
		expect(s.verification).toBe('passed');
		// Live rows first: r2 is the verification row.
		expect(w.calls.refresh).toEqual(['r2', 'r3', 'r1']);
		// The old r2 token was probed exactly once and was rejected.
		expect(w.calls.probe.filter((t) => t === tok('access', 'r2'))).toHaveLength(1);
		// Each new token is used once (Doorkeeper revoke-on-use).
		expect(w.calls.probe).toHaveLength(4);
		expect(w.calls.markRevoked).toEqual([]);
		w.assertNoTokenPrinted([formatSummary(s, 1000)]);
	});

	it('stops after the first row when the old token still works, revokes it, and prints the fallback', async () => {
		const w = makeWorld({rows: rowsFixture(), oldTokenStillWorks: true});
		const s = await runTokenOps(rotateArgs(), w.deps);

		expect(s.exitCode).toBe(2);
		expect(s.verification).toBe('failed');
		expect(w.calls.refresh).toEqual(['r2']);
		expect(w.calls.revoke).toEqual([tok('access', 'r2'), tok('refresh', 'r2')]);
		expect(w.liveTokens.has(tok('access', 'r2'))).toBe(false);
		const text = formatSummary(s, 1000);
		expect(text).toMatch(/revoke --service wca/);
		w.assertNoTokenPrinted([text]);
	});

	it('stops without guessing when verification is inconclusive', async () => {
		const old = tok('access', 'r2');
		const w = makeWorld({rows: rowsFixture(), probeOverride: (t) => (t === old ? 503 : null)});
		const s = await runTokenOps(rotateArgs(), w.deps);
		expect(s.exitCode).toBe(1);
		expect(s.verification).toBe('inconclusive');
		expect(w.calls.refresh).toEqual(['r2']);
		expect(w.calls.revoke).toEqual([]);
	});

	it('skips verification when no access token is live any more', async () => {
		const rows = rowsFixture().map((r) => ({...r, expiresAt: NOW - HOUR}));
		const w = makeWorld({rows});
		const s = await runTokenOps(rotateArgs(), w.deps);
		expect(s.rotated).toBe(3);
		expect(s.verification).toBe('not_needed');
	});

	it('marks a dead grant revoked and carries on', async () => {
		const dead = Object.assign(new Error('The provided authorization grant is invalid'), {
			status: 400,
			oauthError: 'invalid_grant',
		});
		const w = makeWorld({rows: rowsFixture(), refreshBehaviour: (r) => (r.id === 'r3' ? dead : null)});
		const s = await runTokenOps(rotateArgs(), w.deps);
		expect(s.exitCode).toBe(0);
		expect(s.rotated).toBe(2);
		expect(s.deadGrants).toBe(1);
		expect(w.calls.markRevoked).toEqual(['r3']);
	});

	it('does not mark a link dead when invalid_grant came from a concurrent refresh', async () => {
		const dead = Object.assign(new Error('The provided authorization grant is invalid'), {
			status: 400,
			oauthError: 'invalid_grant',
		});
		const w = makeWorld({
			rows: rowsFixture(),
			refreshBehaviour: (r) => {
				if (r.id !== 'r3') return null;
				// The app (or the nightly backfill) spent the refresh token first.
				r.refresh = tok('refresh', 'r3', 9);
				return dead;
			},
		});
		const s = await runTokenOps(rotateArgs(), w.deps);
		expect(s.exitCode).toBe(0);
		expect(s.deadGrants).toBe(0);
		expect(s.skipped).toBe(1);
		expect(w.db.get('r3')!.revoked).toBe(false);
		// Not final: the next run looks at r3 again.
		expect(w.deps.state.done.has('r3')).toBe(false);
	});

	it('stops between rows when the operator asks, without a half-done row', async () => {
		const w = makeWorld({rows: rowsFixture()});
		let stop = false;
		w.deps.shouldStop = () => stop;
		const refresh = w.deps.refresh.bind(w.deps);
		w.deps.refresh = async (row) => {
			const out = await refresh(row);
			stop = true;
			return out;
		};
		const s = await runTokenOps(rotateArgs(), w.deps);
		expect(s.exitCode).toBe(130);
		expect(s.rotated).toBe(1);
		expect(w.calls.refresh).toEqual(['r2']);
		// The row in flight was finished, including its verification.
		expect(s.verification).toBe('passed');
	});

	it('aborts on a rejected client instead of marking everybody dead', async () => {
		const bad = Object.assign(new Error('Client authentication failed'), {status: 401, oauthError: 'invalid_client'});
		const w = makeWorld({rows: rowsFixture(), refreshBehaviour: () => bad});
		const s = await runTokenOps(rotateArgs(), w.deps);
		expect(s.exitCode).toBe(1);
		expect(s.aborted).toMatch(/status=401/);
		expect(w.calls.refresh).toHaveLength(1);
		expect(w.calls.markRevoked).toEqual([]);
	});

	it('leaves rows untouched on transient errors and gives up after a streak', async () => {
		const rows: FakeRow[] = Array.from({length: 8}, (_, i) => ({
			id: `t${i}`,
			access: tok('access', `t${i}`),
			refresh: tok('refresh', `t${i}`),
			expiresAt: NOW - HOUR,
		}));
		const w = makeWorld({rows, refreshBehaviour: () => Object.assign(new Error('boom'), {status: 502})});
		const s = await runTokenOps(rotateArgs(), w.deps);
		expect(s.failed).toBe(5);
		expect(s.aborted).toMatch(/geçici/);
		expect(w.calls.markRevoked).toEqual([]);
		expect(w.deps.state.done.size).toBe(0);
	});

	it('waits out one 429 and retries the same row', async () => {
		const limited = Object.assign(new Error('rate_limited'), {status: 429, oauthError: 'rate_limited'});
		const w = makeWorld({
			rows: rowsFixture(),
			refreshBehaviour: (r, attempt) => (r.id === 'r2' && attempt === 1 ? limited : null),
		});
		const s = await runTokenOps(rotateArgs(), w.deps);
		expect(s.exitCode).toBe(0);
		expect(s.rotated).toBe(3);
		expect(w.clock.slept).toContain(RATE_LIMIT_WAIT_MS);
	});

	it('is resumable: a second run with the same state file does nothing', async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oauth-ops-run-'));
		try {
			const stateFile = path.join(dir, 'rotate-wca.jsonl');
			const w1 = makeWorld({rows: rowsFixture(), stateFile});
			await runTokenOps(rotateArgs({stateFile, limit: 1}), w1.deps);
			expect(w1.calls.refresh).toEqual(['r2']);

			const w2 = makeWorld({rows: rowsFixture(), stateFile});
			const s2 = await runTokenOps(rotateArgs({stateFile}), w2.deps);
			expect(w2.calls.refresh).toEqual(['r3', 'r1']);
			expect(s2.alreadyDone).toBe(1);
			// Verified in the first run: no second probe of an old token.
			expect(s2.verification).toBe('already');

			const w3 = makeWorld({rows: rowsFixture(), stateFile});
			const s3 = await runTokenOps(rotateArgs({stateFile}), w3.deps);
			expect(s3.selected).toBe(0);
			expect(w3.calls.refresh).toEqual([]);
			expect(fs.readFileSync(stateFile, 'utf8')).not.toContain('xxxxxxxx');
		} finally {
			fs.rmSync(dir, {recursive: true, force: true});
		}
	});

	it('ZKT does not spend a request on the new token', async () => {
		const w = makeWorld({rows: rowsFixture(), touchNewToken: false});
		const s = await runTokenOps(rotateArgs({service: 'zkt'}), w.deps);
		expect(s.rotated).toBe(3);
		expect(w.calls.probe).toEqual([tok('access', 'r2')]);
	});
});

describe('runTokenOps revoke', () => {
	const revokeArgs = (over: Partial<OpsArgs> = {}) => rotateArgs({command: 'revoke', ...over});

	it('revokes access and refresh, then writes revoked_at, without printing tokens', async () => {
		const w = makeWorld({rows: rowsFixture()});
		const s = await runTokenOps(revokeArgs(), w.deps);
		expect(s.exitCode).toBe(0);
		expect(s.revoked).toBe(3);
		expect(s.verification).toBe('skipped');
		expect(w.calls.revoke).toHaveLength(6);
		expect(w.calls.markRevoked.sort()).toEqual(['r1', 'r2', 'r3']);
		expect(w.calls.refresh).toEqual([]);
		w.assertNoTokenPrinted([formatSummary(s, 1000)]);
	});

	it('does not write revoked_at when the provider call failed', async () => {
		const w = makeWorld({
			rows: rowsFixture(),
			revokeBehaviour: (t) => (t === tok('refresh', 'r3') ? Object.assign(new Error('down'), {status: 503}) : null),
		});
		const s = await runTokenOps(revokeArgs(), w.deps);
		expect(s.revoked).toBe(2);
		expect(s.failed).toBe(1);
		expect(w.calls.markRevoked).not.toContain('r3');
	});
});

describe('acquireRunLock', () => {
	it('refuses a second live run, takes over a stale lock, and releases only its own', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oauth-ops-lock-'));
		try {
			const file = path.join(dir, 'wca.lock');
			const release = acquireRunLock(file, 100, () => true);
			expect(fs.readFileSync(file, 'utf8')).toBe('100');
			expect(() => acquireRunLock(file, 200, () => true)).toThrow(/pid 100/);

			// Holder is gone: the lock is taken over.
			const release2 = acquireRunLock(file, 200, () => false);
			expect(fs.readFileSync(file, 'utf8')).toBe('200');
			// The first holder's release must not delete the new holder's lock.
			release();
			expect(fs.existsSync(file)).toBe(true);
			release2();
			expect(fs.existsSync(file)).toBe(false);
		} finally {
			fs.rmSync(dir, {recursive: true, force: true});
		}
	});
});

describe('formatReport', () => {
	it('shows counts and how long the last token lives', () => {
		const text = formatReport(
			[
				{
					service_name: 'wca',
					rows: 10,
					active: 8,
					active_with_refresh: 8,
					access_still_valid: 3,
					access_still_valid_active: 2,
					latest_expiry: NOW + 2 * HOUR,
				},
				{
					service_name: 'zkt',
					rows: 2,
					active: 2,
					active_with_refresh: 2,
					access_still_valid: 0,
					access_still_valid_active: 0,
					latest_expiry: NOW - HOUR,
				},
			],
			NOW
		);
		expect(text).toMatch(/wca \| 10 \| 8 \| 8 \| 3 \| 2 \| .*2\.0 saat sonra/);
		expect(text).toMatch(/zkt .*hepsi dolmuş/);
		expect(formatReport([], NOW)).toMatch(/boş/);
	});
});
