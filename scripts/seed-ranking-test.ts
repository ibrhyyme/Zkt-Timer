import {PrismaClient} from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const WCA_API = 'https://www.worldcubeassociation.org/api/v0';

const TEST_USERS = [
	{username: 'maxpark', firstName: 'Max', lastName: 'Park', wcaId: '2012PARK03'},
	{username: 'feliksz', firstName: 'Feliks', lastName: 'Zemdegs', wcaId: '2009ZEMD01'},
	{username: 'stanleychapel', firstName: 'Stanley', lastName: 'Chapel', wcaId: '2016CHAP04'},
	{username: 'lukegarrett', firstName: 'Luke', lastName: 'Garrett', wcaId: '2017GARR05'},
	{username: 'yushengdu', firstName: 'Yusheng', lastName: 'Du', wcaId: '2015DUYU01'},
	{username: 'tymonk', firstName: 'Tymon', lastName: 'Kolasinski', wcaId: '2016KOLA02'},
	{username: 'jakubcz', firstName: 'Jakub', lastName: 'Czerniak', wcaId: '2014CZER01'},
	{username: 'yihengw', firstName: 'Yiheng', lastName: 'Wang', wcaId: '2017XIAY01'},
	{username: 'maxsiauw', firstName: 'Max', lastName: 'Siauw', wcaId: '2021MACH03'},
	{username: 'ruihangxu', firstName: 'Ruihang', lastName: 'Xu', wcaId: '2013EGDA02'},
];

const RANKING_EVENTS = [
	'333', '222', '444', '555', '666', '777',
	'333bf', '333fm', '333oh',
	'minx', 'pyram', 'clock', 'skewb', 'sq1',
	'444bf', '555bf', '333mbf',
];

const BEST_OF_EVENTS = ['333bf', '444bf', '555bf', '333fm'];

const SUPPORTED_EVENTS = [
	'333', '222', '444', '555', '666', '777',
	'333bf', '333fm', '333oh', '333ft',
	'minx', 'pyram', 'clock', 'skewb', 'sq1',
	'444bf', '555bf', '333mbf',
];

// Current WCA World Records (centiseconds, FMC=moves, MBLD=encoded)
// Source: Wikipedia "List of world records in speedcubing" (March 2026)
const WORLD_RECORDS: Record<string, {single: number; average: number}> = {
	'333':    {single: 276,   average: 384},
	'222':    {single: 39,    average: 86},
	'444':    {single: 1518,  average: 1856},
	'555':    {single: 3045,  average: 3431},
	'666':    {single: 5769,  average: 6504},
	'777':    {single: 9348,  average: 9686},
	'333bf':  {single: 1167,  average: 1405},
	'333fm':  {single: 16,    average: 1933},  // FMC: moves, average in centimoves (19.33*100)
	'333oh':  {single: 566,   average: 772},
	'minx':   {single: 2199,  average: 2438},
	'pyram':  {single: 73,    average: 114},
	'clock':  {single: 153,   average: 224},
	'skewb':  {single: 73,    average: 137},
	'sq1':    {single: 340,   average: 463},
	'444bf':  {single: 5196,  average: 5939},
	'555bf':  {single: 11859, average: 14763},
	'333mbf': {single: 930058230065, average: 0}, // 63/65 in 58:23 encoded
};

// Approximate max competitor counts per event (for SoR penalty)
const MAX_RANKS: Record<string, {single: number; average: number}> = {
	'333':    {single: 250000, average: 200000},
	'222':    {single: 120000, average: 100000},
	'444':    {single: 80000,  average: 65000},
	'555':    {single: 50000,  average: 40000},
	'666':    {single: 20000,  average: 18000},
	'777':    {single: 18000,  average: 15000},
	'333bf':  {single: 15000,  average: 5000},
	'333fm':  {single: 12000,  average: 5000},
	'333oh':  {single: 70000,  average: 55000},
	'minx':   {single: 40000,  average: 30000},
	'pyram':  {single: 80000,  average: 65000},
	'clock':  {single: 30000,  average: 25000},
	'skewb':  {single: 50000,  average: 40000},
	'sq1':    {single: 30000,  average: 25000},
	'444bf':  {single: 3000,   average: 500},
	'555bf':  {single: 1500,   average: 300},
	'333mbf': {single: 5000,   average: 0},
};

// --- Pure calculation functions (no server deps) ---

function mbldScore(value: number): number {
	if (!value) return 0;
	const seconds = Math.floor(value / 100) % 1e5;
	const points = 99 - (Math.floor(value / 1e7) % 100);
	const centiseconds = seconds === 99999 ? null : seconds * 100;
	if (centiseconds === null) return Math.max(points, 0);
	const proportionOfHourLeft = 1 - centiseconds / 360000;
	return Math.max(points + proportionOfHourLeft, 0);
}

function calcKinch(
	records: {wca_event: string; single_record: number | null; average_record: number | null}[],
	worldRecords: Record<string, {single: number; average: number}>
) {
	const recordMap = new Map(records.map((r) => [r.wca_event, r]));
	const events: {eventId: string; score: number}[] = [];

	for (const eventId of RANKING_EVENTS) {
		const rec = recordMap.get(eventId);
		const wr = worldRecords[eventId];
		if (!wr) { events.push({eventId, score: 0}); continue; }

		const uS = rec?.single_record || 0;
		const uA = rec?.average_record || 0;
		const wrS = wr.single || 0;
		const wrA = wr.average || 0;

		if (eventId === '333mbf') {
			const ps = mbldScore(uS), rs = mbldScore(wrS);
			events.push({eventId, score: rs ? Math.round((ps / rs * 100) * 100) / 100 : (uS ? 100 : 0)});
			continue;
		}

		if (BEST_OF_EVENTS.includes(eventId)) {
			if (!uS) { events.push({eventId, score: 0}); continue; }
			if (!wrS || !wrA) { events.push({eventId, score: 100}); continue; }
			if (!uA) { events.push({eventId, score: Math.round((wrS / uS * 100) * 100) / 100}); continue; }
			const ss = (wrS / uS) * 100, as2 = (wrA / uA) * 100;
			events.push({eventId, score: Math.round(Math.max(ss, as2) * 100) / 100});
			continue;
		}

		if (!uA) { events.push({eventId, score: 0}); continue; }
		if (!wrA) { events.push({eventId, score: 100}); continue; }
		events.push({eventId, score: Math.round((wrA / uA * 100) * 100) / 100});
	}

	const sum = events.reduce((a, e) => a + e.score, 0);
	return Math.round((sum / events.length) * 100) / 100;
}

function calcSoR(
	records: {wca_event: string; single_world_rank: number | null; average_world_rank: number | null}[],
	maxRanks: Record<string, {single: number; average: number}>
) {
	const recordMap = new Map(records.map((r) => [r.wca_event, r]));
	let singleSum = 0, averageSum = 0;

	for (const eventId of RANKING_EVENTS) {
		const rec = recordMap.get(eventId);
		const max = maxRanks[eventId] || {single: 0, average: 0};
		singleSum += rec?.single_world_rank || (max.single + 1);
		if (eventId !== '333mbf') {
			averageSum += rec?.average_world_rank || (max.average + 1);
		}
	}

	return {single: singleSum, average: averageSum};
}

// --- Main ---

async function main() {
	console.log('[Seed] Using hardcoded world records (March 2026)');

	// 2. Process each user
	for (const tu of TEST_USERS) {
		console.log(`\n[${tu.username}] Fetching WCA data for ${tu.wcaId}...`);

		let wcaPerson: any;
		try {
			const res = await axios.get(`${WCA_API}/persons/${tu.wcaId}`, {timeout: 10000});
			wcaPerson = res.data;
		} catch {
			console.log(`  SKIP: WCA API failed`);
			continue;
		}
		console.log(`  ${wcaPerson.name} (${wcaPerson.country_iso2})`);

		// Create user
		let user = await prisma.userAccount.findUnique({where: {username: tu.username}});
		if (!user) {
			user = await prisma.userAccount.create({
				data: {
					email: `${tu.username}@test.zktimer.com`,
					password: '$2b$10$dummyhashnotarealpasswordhash000000000000000000',
					first_name: tu.firstName,
					last_name: tu.lastName,
					username: tu.username,
					join_ip: '127.0.0.1',
					join_country: wcaPerson.country_iso2 || 'US',
					verified: true,
					email_verified: true,
				},
			});
			await prisma.profile.create({data: {user_id: user.id, bio: `${wcaPerson.name}`}});
			console.log(`  User created`);
		} else {
			console.log(`  User exists`);
		}

		// Create integration
		let integration = await prisma.integration.findFirst({where: {user_id: user.id, service_name: 'wca'}});
		if (!integration) {
			integration = await prisma.integration.create({
				data: {
					user_id: user.id,
					service_name: 'wca',
					auth_token: 'test_token',
					refresh_token: 'test_refresh',
					auth_expires_at: BigInt(Date.now() + 86400000),
					wca_id: tu.wcaId,
					wca_country_iso2: wcaPerson.country_iso2,
					wca_competition_count: wcaPerson.competition_count,
					wca_medal_gold: wcaPerson.medals?.gold || 0,
					wca_medal_silver: wcaPerson.medals?.silver || 0,
					wca_medal_bronze: wcaPerson.medals?.bronze || 0,
					wca_record_nr: wcaPerson.records?.national || 0,
					wca_record_cr: wcaPerson.records?.continental || 0,
					wca_record_wr: wcaPerson.records?.world || 0,
				},
			});
			console.log(`  Integration created`);
		} else {
			console.log(`  Integration exists`);
		}

		// Save WCA records
		let eventCount = 0;
		for (const eventCode of SUPPORTED_EVENTS) {
			const pr = wcaPerson.personal_records[eventCode];
			if (!pr || (!pr.single && !pr.average)) continue;

			await prisma.wcaRecord.upsert({
				where: {user_id_wca_event: {user_id: user.id, wca_event: eventCode}},
				create: {
					user_id: user.id, integration_id: integration.id, wca_event: eventCode,
					single_record: pr.single?.best || null, average_record: pr.average?.best || null,
					single_world_rank: pr.single?.world_rank || null, average_world_rank: pr.average?.world_rank || null,
					single_continent_rank: pr.single?.continent_rank || null, average_continent_rank: pr.average?.continent_rank || null,
					single_country_rank: pr.single?.country_rank || null, average_country_rank: pr.average?.country_rank || null,
					published: true, fetched_at: new Date(),
				},
				update: {
					single_record: pr.single?.best || null, average_record: pr.average?.best || null,
					single_world_rank: pr.single?.world_rank || null, average_world_rank: pr.average?.world_rank || null,
					single_continent_rank: pr.single?.continent_rank || null, average_continent_rank: pr.average?.continent_rank || null,
					single_country_rank: pr.single?.country_rank || null, average_country_rank: pr.average?.country_rank || null,
					fetched_at: new Date(),
				},
			});
			eventCount++;
		}
		console.log(`  ${eventCount} events saved`);

		// Calculate rankings
		const wcaRecords = await prisma.wcaRecord.findMany({where: {user_id: user.id}});
		const kinch = calcKinch(wcaRecords, WORLD_RECORDS);
		const sor = calcSoR(wcaRecords, MAX_RANKS);

		await prisma.integration.update({
			where: {id: integration.id},
			data: {kinch_score: kinch, sor_single: sor.single, sor_average: sor.average, ranks_updated_at: new Date()},
		});

		console.log(`  Kinch: ${kinch} | SoR Single: ${sor.single} | SoR Average: ${sor.average}`);
	}

	console.log('\n[Seed] Done! Refresh /ranks to see results.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
