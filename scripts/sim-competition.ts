/**
 * End-to-end ZKT competition simulation against the LOCAL database.
 *
 * Exercises the real model layer the same way the resolvers do — create a
 * competition, register 10 users across multiple events, approve/waitlist by
 * competitor limit, enter Round 1 times (with a no-show), block-test publish,
 * finalize rounds (rankings + advancement carry + records + round-finished
 * notifications), run a Round 2 final for 3x3, delete the record-holding
 * result to verify the record rebuild, then publish.
 *
 * No HTTP/socket layer: model functions are called directly. The heavy model
 * imports are side-effect-free; the notification module is loaded lazily so an
 * email/push dependency can never abort the main flow. LOCAL DB ONLY.
 *
 *   Run:     npx ts-node --transpile-only scripts/sim-competition.ts
 *   Cleanup: npx ts-node --transpile-only scripts/sim-competition.ts --cleanup
 */
import {getPrisma, initPrisma} from '../server/database';
import {createZktCompetitionWithEvents, publishZktResults} from '../server/models/zkt_competition';
import {upsertZktResult, markResultNoShow, finalizeRound, DNF} from '../server/models/zkt_result';
import {checkAndApplyRecords, rebuildRecordsForEvent, getCurrentRecord} from '../server/models/zkt_record';
import {importZktCompetitors} from '../server/models/zkt_person';
import {getZktPodiums, getZktAllTimeRankings} from '../server/models/zkt_podium';

// The model layer reads a shared singleton; server boot calls this — we must too.
initPrisma();
const prisma = getPrisma();

const SIM_DOMAIN = '@sim.local';
const SIM_COMP_NAME = '[SIM] Avalanche Test Yarismasi';
const EVENTS = ['333', '222', '444', 'pyram'];
const EVENT_NAMES: Record<string, string> = {
	'333': '3x3x3', '222': '2x2x2', '444': '4x4x4', 'pyram': 'Pyraminx',
};
// Realistic per-event single ranges in centiseconds (WCA convention).
const TIME_BASE: Record<string, [number, number]> = {
	'333': [900, 1900], '222': [180, 480], '444': [3500, 6500], 'pyram': [380, 1000],
};
const TR_NAMES: [string, string][] = [
	['Ahmet', 'Yilmaz'], ['Mehmet', 'Kaya'], ['Mustafa', 'Demir'], ['Elif', 'Sahin'],
	['Zeynep', 'Celik'], ['Emre', 'Yildiz'], ['Burak', 'Arslan'], ['Ayse', 'Dogan'],
	['Can', 'Kilic'], ['Deniz', 'Aydin'],
];
const COUNTRIES = ['TR', 'TR', 'TR', 'TR', 'TR', 'TR', 'TR', 'TR', 'AZ', 'DE'];

function randInt(min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[], n: number): T[] {
	const copy = [...arr];
	const out: T[] = [];
	while (out.length < n && copy.length) out.push(copy.splice(randInt(0, copy.length - 1), 1)[0]);
	return out;
}
// Per-attempt times for an event, scaled by competitor skill; ~7% chance of DNF.
function realisticTimes(eventId: string, skill: number): (number | null)[] {
	const [lo, hi] = TIME_BASE[eventId];
	const out: (number | null)[] = [];
	for (let i = 0; i < 5; i++) {
		if (Math.random() < 0.07) { out.push(DNF); continue; }
		out.push(Math.round(randInt(lo, hi) * skill));
	}
	return out;
}

const log = (s = '') => console.log(s);
const hr = () => log('-'.repeat(64));

// Notification module is loaded lazily — its email/push transitive imports must
// not be able to abort the simulation. Disabled permanently on first failure.
let NotifClass: any = null;
let notifDisabled = false;
function getNotifClass() {
	if (notifDisabled) return null;
	if (NotifClass) return NotifClass;
	try {
		NotifClass = require('../server/resources/notification_types/zkt_round_finished').default;
		return NotifClass;
	} catch (e: any) {
		notifDisabled = true;
		log(`   (bildirim modulu yuklenemedi, atlaniyor: ${e?.message})`);
		return null;
	}
}

async function cleanup() {
	log('Temizlik: SIM verileri siliniyor...');
	const comps = await prisma.zktCompetition.findMany({
		where: {name: {startsWith: '[SIM]'}}, select: {id: true},
	});
	for (const c of comps) await prisma.zktCompetition.delete({where: {id: c.id}});
	const del = await prisma.userAccount.deleteMany({where: {email: {endsWith: SIM_DOMAIN}}});
	log(`Silindi: ${comps.length} yarisma, ${del.count} kullanici.`);
	await prisma.$disconnect();
}

async function main() {
	if (process.argv.includes('--cleanup')) return cleanup();

	// Fresh slate: remove any leftovers from a previous run.
	const prev = await prisma.zktCompetition.findMany({where: {name: {startsWith: '[SIM]'}}, select: {id: true}});
	for (const c of prev) await prisma.zktCompetition.delete({where: {id: c.id}});

	hr(); log('ZKT YARISMA SIMULASYONU (lokal DB)'); hr();

	// 1) Users -----------------------------------------------------------
	const admin = await prisma.userAccount.upsert({
		where: {email: `sim-admin${SIM_DOMAIN}`},
		update: {admin: true},
		create: {
			email: `sim-admin${SIM_DOMAIN}`, first_name: 'Sim', last_name: 'Delege',
			join_ip: '127.0.0.1', join_country: 'TR', admin: true,
			username: 'sim_delege', verified: true, email_verified: true,
		},
	});
	const competitors: Array<any> = [];
	for (let i = 0; i < 10; i++) {
		const [fn, ln] = TR_NAMES[i];
		const u = await prisma.userAccount.upsert({
			where: {email: `sim-c${i}${SIM_DOMAIN}`},
			update: {},
			create: {
				email: `sim-c${i}${SIM_DOMAIN}`, first_name: fn, last_name: ln,
				join_ip: '127.0.0.1', join_country: COUNTRIES[i],
				username: `sim_c${i}`, verified: true, email_verified: true,
			},
		});
		competitors.push({...u, skill: 0.7 + Math.random() * 0.6});
	}
	log(`1) Kullanici: 1 delege(admin) + ${competitors.length} yarismaci olusturuldu.`);

	// 2) Competition (4 events, each auto-gets Round 1 AO5) --------------
	const now = new Date();
	const comp = await createZktCompetitionWithEvents({
		createdById: admin.id,
		name: SIM_COMP_NAME,
		description: 'Otomatik simulasyon yarismasi.',
		dateStart: new Date(now.getTime() + 7 * 864e5),
		dateEnd: new Date(now.getTime() + 7 * 864e5),
		location: 'Test Spor Salonu, Istanbul',
		locationAddress: 'Istanbul, Turkiye',
		visibility: 'PUBLIC',
		competitorLimit: 8,
		eventIds: EVENTS,
	});
	const ceByEvent: Record<string, any> = {};
	for (const ce of comp.events) ceByEvent[ce.event_id] = ce;
	log(`2) Yarisma olusturuldu: "${comp.name}" — ${EVENTS.length} kategori (${EVENTS.join(', ')}), limit 8.`);

	// 3) Registrations (each picks 1-3 events) ---------------------------
	const regs: Array<any> = [];
	for (const c of competitors) {
		const chosen = pick(EVENTS, randInt(1, 3));
		const reg = await prisma.zktRegistration.create({
			data: {competition_id: comp.id, user_id: c.id, status: 'PENDING'},
		});
		for (const ev of chosen) {
			await prisma.zktRegistrationEvent.create({
				data: {registration_id: reg.id, comp_event_id: ceByEvent[ev].id},
			});
		}
		regs.push({reg, user: c, events: chosen, status: 'PENDING'});
	}
	log(`3) Kayit: ${regs.length} yarismaci basvurdu (rastgele 1-3 kategori).`);

	// 4) Approve first 8, waitlist last 2 (competitor limit) -------------
	let approved = 0, waitlisted = 0;
	for (let i = 0; i < regs.length; i++) {
		const isApproved = i < 8;
		regs[i].status = isApproved ? 'APPROVED' : 'WAITLISTED';
		await prisma.zktRegistration.update({
			where: {id: regs[i].reg.id},
			data: {status: regs[i].status, waiting_list_position: isApproved ? null : i - 7},
		});
		if (isApproved) approved++; else waitlisted++;
	}
	log(`4) Onay: ${approved} onaylandi, ${waitlisted} bekleme listesinde (limit 8).`);

	const approvedFor = (ev: string) =>
		regs.filter(r => r.status === 'APPROVED' && r.events.includes(ev)).map(r => r.user);

	// 5) Competition ONGOING; create groups + assignments + enter times --
	await prisma.zktCompetition.update({where: {id: comp.id}, data: {status: 'ONGOING'}});
	const round1ByEvent: Record<string, any> = {};
	let totalGroups = 0, totalAssignments = 0;
	for (let ei = 0; ei < EVENTS.length; ei++) {
		const ev = EVENTS[ei];
		const r1 = ceByEvent[ev].rounds.find((r: any) => r.round_number === 1);
		round1ByEvent[ev] = r1;
		await prisma.zktRound.update({where: {id: r1.id}, data: {status: 'ACTIVE'}});
		const entrants = approvedFor(ev);

		// Groups: split entrants into 1-2 groups, each event an hour apart.
		const groupCount = entrants.length > 4 ? 2 : 1;
		const dayStart = new Date(comp.date_start);
		dayStart.setHours(10 + ei, 0, 0, 0);
		const groups: any[] = [];
		for (let g = 0; g < groupCount; g++) {
			const start = new Date(dayStart.getTime() + g * 30 * 60000);
			const end = new Date(start.getTime() + 30 * 60000);
			const grp = await prisma.zktGroup.create({
				data: {round_id: r1.id, group_number: g + 1, start_time: start, end_time: end},
			});
			groups.push(grp);
			totalGroups++;
		}

		// COMPETITOR assignment: each entrant -> a group + station number.
		for (let i = 0; i < entrants.length; i++) {
			const grp = groups[i % groups.length];
			await prisma.zktAssignment.create({
				data: {
					round_id: r1.id, user_id: entrants[i].id, role: 'COMPETITOR',
					group_id: grp.id, station_number: Math.floor(i / groups.length) + 1,
				},
			});
			totalAssignments++;
		}

		// Staff: up to 3 people NOT competing in this event (judge/scrambler/runner).
		const staffPool = competitors.filter((c) => !entrants.some((e: any) => e.id === c.id));
		const pool = staffPool.length >= 3 ? staffPool : competitors;
		const staffRoles = ['JUDGE', 'SCRAMBLER', 'RUNNER'] as const;
		for (let i = 0; i < 3 && i < pool.length; i++) {
			await prisma.zktAssignment.create({
				data: {round_id: r1.id, user_id: pool[i].id, role: staffRoles[i], group_id: groups[i % groups.length].id},
			});
			totalAssignments++;
		}

		// Times.
		for (const u of entrants) {
			const t = realisticTimes(ev, u.skill);
			await upsertZktResult({
				round_id: r1.id, user_id: u.id, entered_by_id: admin.id,
				attempt_1: t[0], attempt_2: t[1], attempt_3: t[2], attempt_4: t[3], attempt_5: t[4],
			});
		}
		log(`   - ${EVENT_NAMES[ev]} Tur 1: ${groupCount} grup, ${entrants.length} sonuc, gorevler atandi.`);
	}
	log(`5b) Grup + gorev: ${totalGroups} grup, ${totalAssignments} atama olusturuldu.`);
	// One no-show in 3x3 (came up as DNS / no_show).
	const e333entrants = approvedFor('333');
	if (e333entrants.length > 3) {
		await markResultNoShow({round_id: round1ByEvent['333'].id, user_id: e333entrants[e333entrants.length - 1].id, entered_by_id: admin.id});
		log('   - 3x3x3 Tur 1: 1 yarismaci no-show isaretlendi.');
	}
	log('5) Yarisma ONGOING, tum Tur 1 sonuclari girildi.');

	// 6) NEGATIVE publish test — rounds not finished yet -----------------
	await prisma.zktCompetition.update({where: {id: comp.id}, data: {status: 'FINISHED'}});
	let blocked = false, blockMsg = '';
	try { await publishZktResults(comp.id); }
	catch (e: any) { blocked = true; blockMsg = e?.message || String(e); }
	log(`6) Yayinla(turlar bitmeden): ${blocked ? 'ENGELLENDI [beklenen] — ' + blockMsg : 'ENGELLENMEDI [HATA: blocker calismadi]'}`);
	await prisma.zktCompetition.update({where: {id: comp.id}, data: {status: 'ONGOING'}});

	// 7) 3x3 advancement to a Round 2 (top 3) ----------------------------
	const r1_333 = round1ByEvent['333'];
	await prisma.zktRound.update({where: {id: r1_333.id}, data: {advancement_type: 'RANKING', advancement_level: 3}});
	const r2_333 = await prisma.zktRound.create({
		data: {comp_event_id: ceByEvent['333'].id, round_number: 2, format: 'AO5'},
	});
	log('7) 3x3x3 icin Tur 2 eklendi (ilk 3 ilerler).');

	// 8) Finalize all Round 1s exactly like the resolver -----------------
	let totalNotifs = 0, notifErrors = 0, nrCount = 0, prCount = 0;
	async function finalizeLikeResolver(roundId: string, eventId: string, isFinal: boolean, roundNumber: number) {
		await finalizeRound(roundId, admin.id); // rankings + advancement + carry + status FINISHED
		const results = await prisma.zktResult.findMany({where: {round_id: roundId}});
		for (const r of results) {
			const tags = await checkAndApplyRecords({
				resultId: r.id, userId: r.user_id, eventId, competitionId: comp.id,
				best: r.best, average: r.average,
			});
			if (tags.singleTag || tags.averageTag) {
				await prisma.zktResult.update({
					where: {id: r.id},
					data: {single_record_tag: tags.singleTag, average_record_tag: tags.averageTag},
				});
				if (tags.singleTag === 'NR') nrCount++;
				if (tags.averageTag === 'NR') nrCount++;
				if (tags.singleTag === 'PR') prCount++;
				if (tags.averageTag === 'PR') prCount++;
			}
		}
		const NC = getNotifClass();
		if (NC) {
			const ranked = results.filter(r => r.ranking != null).sort((a, b) => a.ranking! - b.ranking!);
			for (const r of ranked) {
				try {
					await new NC(
						{user: {id: r.user_id}, triggeringUser: {id: admin.id}, sendEmail: false},
						{
							competitionId: comp.id, competitionName: comp.name,
							eventId, eventName: EVENT_NAMES[eventId], roundNumber,
							ranking: r.ranking!, advancing: r.proceeds, isFinal, locale: 'tr',
						},
					).send();
					totalNotifs++;
				} catch { notifErrors++; }
			}
		}
	}
	for (const ev of EVENTS) {
		await finalizeLikeResolver(round1ByEvent[ev].id, ev, ev !== '333', 1);
	}
	log(`8) Tum Tur 1 finalize edildi. Rekor: ${nrCount} NR, ${prCount} PR. Bildirim: ${totalNotifs} olusturuldu${notifErrors ? ', ' + notifErrors + ' hata' : ''}.`);

	// 9) Round 2 (3x3): carried competitors get times, then finalize -----
	const r2results = await prisma.zktResult.findMany({where: {round_id: r2_333.id}});
	for (const r of r2results) {
		const u = competitors.find(c => c.id === r.user_id)!;
		const t = realisticTimes('333', u.skill * 0.95); // a touch faster in the final
		await upsertZktResult({
			round_id: r2_333.id, user_id: r.user_id, entered_by_id: admin.id,
			attempt_1: t[0], attempt_2: t[1], attempt_3: t[2], attempt_4: t[3], attempt_5: t[4],
		});
	}
	await finalizeLikeResolver(r2_333.id, '333', true, 2);
	log(`9) 3x3x3 Tur 2: ${r2results.length} ilerleyen yarismaci (carry dogrulandi), sonuc girildi + final finalize.`);

	// 10) Record rebuild test: delete the 3x3 single record holder -------
	const recBefore = await getCurrentRecord('333', 'single');
	let rebuildReport = 'rekor yok';
	if (recBefore) {
		const hb = await prisma.userAccount.findUnique({where: {id: recBefore.user_id}, select: {first_name: true}});
		await prisma.zktResult.delete({where: {id: recBefore.result_id}});
		await rebuildRecordsForEvent('333');
		const recAfter = await getCurrentRecord('333', 'single');
		const ha = recAfter ? await prisma.userAccount.findUnique({where: {id: recAfter.user_id}, select: {first_name: true}}) : null;
		rebuildReport = `silmeden once ${recBefore.value}cs (${hb?.first_name}) -> silince ${recAfter ? recAfter.value + 'cs (' + ha?.first_name + ')' : 'rekor kalmadi'}`;
	}
	log(`10) Rekor yeniden hesaplama (NR sahibi sonuc silindi): ${rebuildReport}`);

	// 11) POSITIVE publish test — everything finished --------------------
	await prisma.zktCompetition.update({where: {id: comp.id}, data: {status: 'FINISHED'}});
	let published = false, pubMsg = '';
	try { await publishZktResults(comp.id); published = true; }
	catch (e: any) { pubMsg = e?.message || String(e); }
	log(`11) Yayinla(turlar bitti): ${published ? 'BASARILI' : 'ENGELLENDI [HATA: ' + pubMsg + ']'}`);

	// 12) Final report ---------------------------------------------------
	hr(); log('SONUC RAPORU'); hr();
	for (const ev of EVENTS) {
		const rows = await prisma.zktResult.findMany({
			where: {round_id: round1ByEvent[ev].id, ranking: {not: null}},
			orderBy: {ranking: 'asc'}, take: 3,
			include: {user: {select: {first_name: true, last_name: true, join_country: true}}},
		});
		log(`${EVENT_NAMES[ev]} (Tur 1) ilk 3:`);
		for (const r of rows) {
			const tag = [r.single_record_tag, r.average_record_tag].filter(Boolean).join('/');
			log(`   ${r.ranking}. ${r.user.first_name} ${r.user.last_name} [${r.user.join_country}] — single ${r.best}cs, ort ${r.average}cs${tag ? ' (' + tag + ')' : ''}${r.proceeds ? ' [+]' : ''}`);
		}
	}
	const finalRows = await prisma.zktResult.findMany({
		where: {round_id: r2_333.id, ranking: {not: null}},
		orderBy: {ranking: 'asc'},
		include: {user: {select: {first_name: true, last_name: true}}},
	});
	if (finalRows.length) {
		log('3x3x3 FINAL (Tur 2):');
		for (const r of finalRows) log(`   ${r.ranking}. ${r.user.first_name} ${r.user.last_name} — ort ${r.average}cs`);
	}
	const notifCount = await prisma.notification.count({where: {notification_type: 'zkt_round_finished'}});
	const recCount = await prisma.zktRecord.count();
	const finalStatus = (await prisma.zktCompetition.findUnique({where: {id: comp.id}}))?.status;
	hr();
	log(`Yarisma durumu: ${finalStatus}`);
	log(`In-app tur-bitti bildirimi (DB): ${notifCount}`);
	log(`Toplam aktif rekor satiri (tum eventler): ${recCount}`);
	log('Temizlemek icin: npx ts-node --transpile-only scripts/sim-competition.ts --cleanup');
	hr();

	// 13) GHOST (account-less) competitor flow — separate competition --------
	hr(); log('HAYALET (HESAPSIZ) YARISMACI SENARYOSU'); hr();
	const ghostComp = await createZktCompetitionWithEvents({
		createdById: admin.id,
		name: '[SIM] Hayalet Belediye Yarismasi',
		description: 'Belediye listesinden hesapsiz yarismacilar (CSV import).',
		dateStart: new Date(now.getTime() + 14 * 864e5),
		dateEnd: new Date(now.getTime() + 14 * 864e5),
		location: 'Beyoglu, Istanbul',
		locationAddress: 'Beyoglu, Istanbul',
		visibility: 'PUBLIC',
		competitorLimit: 50,
		eventIds: ['333', '222'],
	});
	const ghostCe: Record<string, any> = {};
	for (const ce of ghostComp.events) ghostCe[ce.event_id] = ce;

	// CSV-like rows: name + surname + municipality id, no ZKT/WCA accounts.
	const ghostRows = [
		{firstName: 'Deniz', lastName: 'Kaya', externalId: 'BLD-001'},
		{firstName: 'Ela', lastName: 'Yildiz', externalId: 'BLD-002'},
		{firstName: 'Mert', lastName: 'Sahin', externalId: 'BLD-003'},
		{firstName: 'Naz', lastName: 'Aydin', externalId: 'BLD-004'},
		{firstName: 'Kuzey', lastName: 'Arslan', externalId: 'BLD-005'},
		{firstName: 'Ada', lastName: 'Dogan', externalId: 'BLD-006'},
	].map((r) => ({...r, country: 'TR', eventIds: [ghostCe['333'].id, ghostCe['222'].id]}));
	const persons = await importZktCompetitors(ghostComp.id, ghostRows);
	log(`13a) Ice aktarildi: ${persons.length} hesapsiz yarismaci (APPROVED, hesap YOK).`);

	// Open 333 Round 1, enter a time for each ghost person (person_id path).
	await prisma.zktCompetition.update({where: {id: ghostComp.id}, data: {status: 'ONGOING'}});
	const gr1 = ghostCe['333'].rounds.find((r: any) => r.round_number === 1);
	await prisma.zktRound.update({where: {id: gr1.id}, data: {status: 'ACTIVE'}});
	for (let i = 0; i < persons.length; i++) {
		const t = realisticTimes('333', 0.8 + i * 0.05);
		await upsertZktResult({
			round_id: gr1.id, person_id: persons[i].id, entered_by_id: admin.id,
			attempt_1: t[0], attempt_2: t[1], attempt_3: t[2], attempt_4: t[3], attempt_5: t[4],
		});
	}
	await finalizeRound(gr1.id, admin.id);
	// Isolation: records are user-only — checkAndApplyRecords is never called for ghosts.
	log(`13b) ${persons.length} hayalet sonucu girildi + Tur 1 finalize (rekor cagrilmadi — izolasyon).`);

	// Podium INCLUDES ghosts (within-competition visibility).
	await prisma.zktCompetition.update({where: {id: ghostComp.id}, data: {status: 'FINISHED'}});
	const ghostPodiums = await getZktPodiums(ghostComp.id);
	const p333 = ghostPodiums.find((p: any) => p.event_id === '333');
	log('13c) Podyum (yarisma-ici — hayaletler GORUNUR):');
	for (const r of (p333?.results || [])) {
		const name = r.person ? `${r.person.first_name} ${r.person.last_name}` : (r.user_id || '?');
		log(`   ${r.ranking}. ${name} [${r.person?.country_code || '-'}] — ${r.best}cs`);
	}

	// All-time ranking EXCLUDES ghosts (global, user-only).
	const allTime = await getZktAllTimeRankings({eventId: '333', recordType: 'single', limit: 100});
	const ghostInRanking = allTime.filter((row: any) => !row.user).length;
	log(`13d) Global all-time 333 single: ${allTime.length} kayit; hayalet=${ghostInRanking} (BEKLENEN 0 — izolasyon dogru).`);
	hr();

	await prisma.$disconnect();
}

main().catch(async (e) => {
	console.error('SIMULASYON HATASI:', e);
	await prisma.$disconnect();
	process.exit(1);
});
