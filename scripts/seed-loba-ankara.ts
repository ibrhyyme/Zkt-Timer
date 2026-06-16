/**
 * Seed a 1:1 copy of the real WCA competition "Loba March Ankara 2026"
 * (worldcubeassociation.org/competitions/LobaMarchAnkara2026) into the ZKT
 * platform: general info, events + round config, program/schedule, the four
 * custom tabs (Guests / Organization Team / FAQ / Groups), delegates +
 * organizer, 59 ghost competitors and realistic results — with the exact
 * solve values shown on the WCA page for each event winner/podium.
 *
 * Run:     npx ts-node --transpile-only scripts/seed-loba-ankara.ts
 * Cleanup: npx ts-node --transpile-only scripts/seed-loba-ankara.ts --cleanup
 */
import {getPrisma, initPrisma} from '../server/database';
import {createZktCompetitionWithEvents, publishZktResults} from '../server/models/zkt_competition';
import {upsertZktResult, finalizeRound, DNF} from '../server/models/zkt_result';
import {importZktCompetitors} from '../server/models/zkt_person';

initPrisma();
const prisma = getPrisma();

const COMP_NAME = 'Loba March Ankara 2026';
const SEED_DOMAIN = '@loba.seed';

const log = (s = '') => console.log(s);
const hr = () => log('-'.repeat(64));
function randInt(min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- Events ---------------------------------------------------------------
const EVENTS = ['333', '222', '333oh', 'clock', 'pyram', 'skewb'];
const EVENT_NAMES: Record<string, string> = {
	'333': '3x3x3',
	'222': '2x2x2',
	'333oh': '3x3 OH',
	clock: 'Clock',
	pyram: 'Pyraminx',
	skewb: 'Skewb',
};

// Per-event round config (in order). tl = time limit cs; cutoffCs/cutoffAtt =
// cutoff; advType/advLevel = advancement. Mirrors the WCA "Events" tab exactly.
type RoundCfg = {
	tl: number;
	cutoffCs?: number;
	cutoffAtt?: number;
	advType?: 'PERCENT' | 'RANKING';
	advLevel?: number;
};
const ROUND_CONFIG: Record<string, RoundCfg[]> = {
	'333': [
		{tl: 18000, advType: 'PERCENT', advLevel: 60},
		{tl: 6000, advType: 'RANKING', advLevel: 8},
		{tl: 6000},
	],
	'222': [
		{tl: 6000, advType: 'PERCENT', advLevel: 60},
		{tl: 6000, advType: 'RANKING', advLevel: 8},
		{tl: 6000},
	],
	'333oh': [
		{tl: 12000, cutoffCs: 5000, cutoffAtt: 2, advType: 'RANKING', advLevel: 6},
		{tl: 9000},
	],
	clock: [{tl: 6000, cutoffCs: 3000, cutoffAtt: 2}],
	pyram: [
		{tl: 6000, advType: 'PERCENT', advLevel: 50},
		{tl: 6000, advType: 'RANKING', advLevel: 6},
		{tl: 6000},
	],
	skewb: [
		{tl: 6000, advType: 'PERCENT', advLevel: 50},
		{tl: 6000, advType: 'RANKING', advLevel: 6},
		{tl: 6000},
	],
};

// Realistic per-attempt single ranges (cs) used for filler competitors.
const TIME_BASE: Record<string, [number, number]> = {
	'333': [800, 2600],
	'222': [180, 760],
	'333oh': [1100, 3600],
	clock: [650, 1900],
	pyram: [260, 950],
	skewb: [260, 950],
};

// --- Competitors ----------------------------------------------------------
// 5 real names (from the WCA page) + 54 filler Turkish names = 59.
const REAL_NAMES: [string, string, string][] = [
	// firstName, lastName, country
	['Ahmet Çınar', 'Ablak', 'TR'],
	['Alim', 'Jahangırov', 'AZ'],
	['Mert', 'Sağdınç', 'TR'],
	['Kerem', 'Karaer', 'TR'],
	['Bora', 'Azizoğlu', 'TR'],
];
const FILLER_FIRST = [
	'Mehmet', 'Mustafa', 'Emre', 'Burak', 'Can', 'Deniz', 'Eren', 'Kaan', 'Yusuf', 'Ege',
	'Berk', 'Arda', 'Onur', 'Selim', 'Tolga', 'Umut', 'Baran', 'Cem', 'Doruk', 'Efe',
	'Furkan', 'Görkem', 'Halil', 'İsmail', 'Kerim', 'Levent', 'Murat', 'Nuri', 'Okan', 'Ozan',
	'Polat', 'Rıza', 'Sarp', 'Taha', 'Ufuk', 'Volkan', 'Yiğit', 'Zafer', 'Elif', 'Zeynep',
	'Ayşe', 'Defne', 'Ece', 'İrem', 'Melis', 'Nehir', 'Selin', 'Sıla', 'Yağmur', 'Beren',
	'Çağla', 'Derin', 'Ada', 'Mira',
];
const FILLER_LAST = [
	'Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Arslan', 'Doğan', 'Kılıç', 'Aydın',
	'Öztürk', 'Aslan', 'Çetin', 'Korkmaz', 'Erdoğan', 'Koç', 'Kurt', 'Özdemir', 'Şimşek', 'Polat',
	'Aksoy', 'Taş', 'Bulut', 'Güneş', 'Acar', 'Bilgin', 'Çakır', 'Duman', 'Eroğlu', 'Fidan',
	'Güler', 'Işık', 'Karaca', 'Mutlu', 'Ünal', 'Yavuz', 'Tekin', 'Sevgi', 'Toprak', 'Aktaş',
	'Bayrak', 'Coşkun', 'Demirci', 'Ekinci', 'Gül', 'Kara', 'Kaplan', 'Soydan', 'Turan', 'Yalçın',
	'Avcı', 'Başaran', 'Çakmak', 'Demiröz',
];

// Exact attempts (cs) for each event's winner, copied from the WCA results
// table ("Solves" column). DNF = -1. () in the UI = trimmed best/worst.
const WINNER_ATTEMPTS: Record<string, {name: [string, string]; attempts: number[]}> = {
	'333': {name: ['Ahmet Çınar', 'Ablak'], attempts: [663, 565, 706, 765, 697]}, // best 5.65 / avg 6.89
	'222': {name: ['Ahmet Çınar', 'Ablak'], attempts: [280, 534, 157, 157, 248]}, // best 1.57 / avg 2.28
	'333oh': {name: ['Ahmet Çınar', 'Ablak'], attempts: [1185, 1247, 1167, 1044, 1244]}, // 10.44 / 11.99
	clock: {name: ['Kerem', 'Karaer'], attempts: [701, 847, 887, 714, 633]}, // 6.33 / 7.54
	pyram: {name: ['Ahmet Çınar', 'Ablak'], attempts: [470, 267, 304, 256, 307]}, // 2.56 / 2.93
	skewb: {name: ['Bora', 'Azizoğlu'], attempts: [264, 309, 347, 492, DNF]}, // 2.64 / 3.83
};
// 3x3 podium 2nd/3rd (exact averages from the highlights line).
const PODIUM_333: Record<string, number[]> = {
	'Alim|Jahangırov': [925, 928, 931, 928, 928], // avg 9.28
	'Mert|Sağdınç': [955, 961, 967, 960, 962], // avg 9.61
};

const nameKey = (f: string, l: string) => `${f}|${l}`;

function realisticTimes(eventId: string, skill: number): (number | null)[] {
	const [lo, hi] = TIME_BASE[eventId];
	const out: (number | null)[] = [];
	for (let i = 0; i < 5; i++) {
		if (Math.random() < 0.06) {
			out.push(DNF);
			continue;
		}
		out.push(Math.round(randInt(lo, hi) * skill));
	}
	return out;
}

// --- Schedule (Europe/Istanbul, GMT+3) ------------------------------------
// Build a Date at the given local Istanbul time on the given day.
function ist(day: '2026-03-07' | '2026-03-08', hh: number, mm: number): Date {
	return new Date(`${day}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+03:00`);
}
const SCHEDULE: Array<{title: string; s: Date; e: Date}> = [
	// Saturday 7 March
	{title: 'Check-in', s: ist('2026-03-07', 9, 0), e: ist('2026-03-07', 9, 45)},
	{title: 'On-site registration', s: ist('2026-03-07', 9, 0), e: ist('2026-03-07', 9, 45)},
	{title: 'Tutorial for new competitors', s: ist('2026-03-07', 9, 30), e: ist('2026-03-07', 10, 0)},
	{title: 'Skewb First round', s: ist('2026-03-07', 10, 0), e: ist('2026-03-07', 11, 15)},
	{title: 'Clock Final', s: ist('2026-03-07', 11, 15), e: ist('2026-03-07', 12, 15)},
	{title: 'Skewb Second round', s: ist('2026-03-07', 12, 15), e: ist('2026-03-07', 13, 0)},
	{title: 'Lunch', s: ist('2026-03-07', 13, 0), e: ist('2026-03-07', 14, 0)},
	{title: 'Pyraminx First round', s: ist('2026-03-07', 14, 0), e: ist('2026-03-07', 15, 15)},
	{title: '3x3 One-Handed First round', s: ist('2026-03-07', 15, 15), e: ist('2026-03-07', 16, 15)},
	{title: 'Pyraminx Second round', s: ist('2026-03-07', 16, 15), e: ist('2026-03-07', 17, 15)},
	{title: '3x3 One-Handed Final', s: ist('2026-03-07', 17, 15), e: ist('2026-03-07', 17, 45)},
	{title: 'Skewb Final', s: ist('2026-03-07', 17, 45), e: ist('2026-03-07', 18, 15)},
	// Sunday 8 March
	{title: 'Check-in', s: ist('2026-03-08', 9, 0), e: ist('2026-03-08', 9, 45)},
	{title: 'On-site registration', s: ist('2026-03-08', 9, 0), e: ist('2026-03-08', 9, 45)},
	{title: 'Tutorial for new competitors', s: ist('2026-03-08', 9, 30), e: ist('2026-03-08', 10, 0)},
	{title: '2x2 Cube First round', s: ist('2026-03-08', 10, 0), e: ist('2026-03-08', 11, 30)},
	{title: '3x3 Cube First round', s: ist('2026-03-08', 11, 30), e: ist('2026-03-08', 13, 0)},
	{title: 'Lunch', s: ist('2026-03-08', 13, 0), e: ist('2026-03-08', 14, 0)},
	{title: '2x2 Cube Second round', s: ist('2026-03-08', 14, 0), e: ist('2026-03-08', 15, 0)},
	{title: '3x3 Cube Second round', s: ist('2026-03-08', 15, 0), e: ist('2026-03-08', 16, 0)},
	{title: 'Pyraminx Final', s: ist('2026-03-08', 16, 0), e: ist('2026-03-08', 16, 30)},
	{title: '2x2 Cube Final', s: ist('2026-03-08', 16, 30), e: ist('2026-03-08', 17, 0)},
	{title: '3x3 Cube Final', s: ist('2026-03-08', 17, 0), e: ist('2026-03-08', 17, 30)},
	{title: 'Certificate Ceremony', s: ist('2026-03-08', 17, 30), e: ist('2026-03-08', 18, 0)},
];

// --- General-info "Information" (description, TR + EN) ---------------------
const DESCRIPTION = `**[TR]**

Kayıt sırasında adınızı ve soyadınızı lütfen kimlikte yazıldığı gibi hatasız giriniz. İlk harfleri büyük yazınız.

Yarışmaya gelirken yanınızda kimlik bulundurmayı unutmayınız. **Lütfen sekmeleri okuyunuz.**

Yarışma alanında fotoğraf ve video çekimi yapılmaktadır.

İletişim 0507 587 3376
İskender Aznavur

---

**[EN]**

Please enter your name and surname during registration as it is written on your ID.
The First letters are capital letters.

Don't forget to have an ID card with you when you come to the competition. **Please read all the tabs.**

Photos and videos are taken in the competition venue.

Contact +90 507 587 3376
İskender Aznavur`;

// --- Custom tabs (TR + EN markdown, verbatim) -----------------------------
const TAB_GUESTS = `**[TR]**

Yarışmanın olacağı salona seyirci (misafir / veli) kabul edilecektir. Ancak seyirciler aşağıdaki kurallara uymak zorundadırlar.

- Yarışma salonunda kamera kullanımı serbesttir. Ancak flaş kullanımı yasaktır.
- Yarışma salonunda "yarışmacılara ayrılan yarışma alanına" (yarışma günü belirtilecek) giriş her ne sebepten olursa olsun yasaktır.
- Yarışma sırasında, herhangi bir şekilde yarışmacıları rahatsız edecek davranıştan kaçınılması gerekmektedir.
- Yarışma sırasında organizatör, delege, hakem veya diğer yarışmacılarla tartışmaya girmekten kaçının. Tüm sorunlar için ana organizatöre, eğer o yoksa da delegeye danışabilirsiniz.

Yukarıdaki kurallara uymayanlar yarışma salonundan uzaklaştırılacaktır.

Sorularınız için iletişim numarası: +90 507 587 3376

**[EN]**

Spectators (guests / parents) will be accepted to the competition venue. However, spectators must comply with the following rules.

- You can use camera in the venue. However, the use of flash is prohibited.
- Entry to the "competition area" allocated to the contestants in the competition venue (to be specified on the competition day) is prohibited for any reason.
- During the competition, any behavior that may disturb the contestants in any way must be avoided.
- Avoid getting into arguments with the organiser, delegate, judges or other competitors during the competition. For all your problems, you can consult the main organizer or, if he is not available, the delegate.

Those who do not comply with the rules will be removed from the competition hall.

For your questions my contact number: +90 507 587 3376`;

const TAB_ORG = `**[TR]**

Organizasyon ekibi aşağıdaki gibidir.
Yarışma öncesi sorularınız için İskender Aznavur'a i.kuleli@gmail.com mail adresi veya +90 507 587 3376 numaradan ulaşabilirsiniz.
Yarışma alanında sorularınız ve danışma için aşağıdaki ekibe danışabilirsiniz.

**Ana Organizatör:**
İskender Aznavur

**Delegeler:**
Mustafa Çamlıca

**Yardımcı Organizatörler:**

**[EN]**

The organization team is shown below.
For your questions before the competition, you can contact İskender Aznavur at i.kuleli@gmail.com or +90 507 587 3376.
You can contact the team below for your questions and consultation in the competition area.

**Main Organizer:**
İskender Aznavur

**Delegates:**
Mustafa Çamlıca

**Assistant Organizers:**`;

const TAB_FAQ = `**[TR]**

Sıkça Sorulan Sorular

**Soru: Yarışmak için kaç yaşında olmam gerekiyor?**
Her yaştan herkes yarışmaya katılabilir!

**Soru: Yarışabilmek için ne kadar hızlı olmam gerekiyor?**
Yarışabilmeniz için sadece küpü çözebiliyor olmanız yeterli! Kategoriler sekmesinden her kategori için süre limitlerini kontrol edebilirsiniz.

**Soru: Yarışma gününden önce neleri bilmem gerekiyor?**
Yarışmaya katılmadan önce WCA kurallarını okumanız gerekiyor. Yarışmacı ve yarışma rehberlerini izlemeniz faydalı olabilir. Ayrıca, yarışma takvimini önceden gözden geçirip, planlamanızı buna göre yapmanızı tavsiye ediyoruz.

**Soru: İkinci tura geçtiğimi nasıl öğrenebilirim?**
Süreleriniz ve yarışma sonuçlarınız, tahmini olarak çözümlerinizin bitişinden bir saat sonra canlı olarak güncellenecektir. Herkesin sonuçları belli olduktan sonra geçip geçmediğinizi WCA Live sitesinde kolaylıkla öğrenebilirsiniz.

**Soru: Yardım için kime başvurabilirim?**
Organizasyon ekibi sekmesine bakabilirsiniz.

**Soru: Yarışma günü yardım edebilir miyim?**
Tabiki de! Yarışma süresi boyunca hakemlere, karıştırmacılara ve runnerlara ihtiyacımız olacaktır. Delegelere, hangi alanda yardım edebileceğiniz konusunda başvurabilirsiniz.

**Soru: Türkiye'deki gelecek yarışmalar hakkında bilgiyi nereden bulabilirim?**
Yarışmalar sekmesinden, gelecek yarışmaları görebilirsiniz.

**Soru: Diğer soruları nereye sorabiliriz?**
Delegelerimize aklınıza takılan sorularınızı yöneltebilirsiniz.

**Soru: Katılımcı sınırı olacak mı?**
Katılımcı sınırımız 100'dür.

**Soru: Başkasının küplerini alabilir miyim?**
Küp paylaşımını önermiyoruz. Ayrıca, küplerinizin yarışmada kullanılabilmek için uygun durumda olup olmamasına dikkat gösterin. Eğer emin değilseniz, delegelere sorularınızı sormaktan çekinmeyin.

**[EN]**

Frequently Asked Questions

**Q. How old do I have to be to compete?**
Anyone can compete at any age! We encourage anyone considering to compete to register as it will be a great experience regardless of age.

**Q. How fast do I have to be to compete?**
To compete you only need to know how to solve the cube! Please check the events tab for information in time limits for each event.

**Q. What do I need to know before the competition day?**
Before attending you should have read and understood the WCA rules. We also recommend that you watch this helpful competitor competition guide and read this competition tutorial. You should also know when your events are scheduled throughout the day.

**Q. How do I find out if I've progressed to the second round?**
Times will be uploaded through the day. Please allow up to an hour from finishing your solves to them being uploaded. After all the times of a round has been entered, you can see if you are in the following round.

**Q. Who can I ask for help on the day?**
You can check the Organization Team tab.

**Q. Can I help on the day?**
Of course! Throughout the day we will need judges and runners so please see our Delegates to ask how you can best assist.

**Q. How do I find out about other upcoming competitions in Turkey?**
You can find out about upcoming competitions in Turkey by looking to the Competitions tab.

**Q. Where can I ask other questions?**
The delegates and the organisational team can answer all your questions.

**Q. Will there be an attendee limit at this competition?**
There is an attendee limit of 100.

**Q. Can I still borrow some one else's puzzles?**
We advise against sharing of puzzles. Please make sure your puzzles are legal for competition, especially for events such as 3x3 blindfolded (no logos!). All of the information regarding cube legality can be found in the WCA Regulations. If you are unsure about this please don't hesitate to contact the organisers with any questions.`;

const TAB_GROUPS = `**[TR]**

Yarışmada yarışacağınız ve görev alacağınız grupları aşağıdaki linkten güncel olarak görebilirsiniz.
Grubunuzu kaçırırsanız başka grupta yarışamazsınız.
Size verilen görevleri yapmazsanız yarışmadan diskalifiye edilirsiniz.

[Gruplar](#)

**[EN]**

You can see the groups you will compete and take part in from the link below.
If you miss your group, you cannot compete in another group.
If you do not complete the tasks given to you, you will be disqualified from the competition.

[Groups](#)`;

// ==========================================================================

async function cleanup() {
	log('Temizlik: Loba Ankara seed verileri siliniyor...');
	const comps = await prisma.zktCompetition.findMany({
		where: {name: COMP_NAME},
		select: {id: true},
	});
	for (const c of comps) await prisma.zktCompetition.delete({where: {id: c.id}});
	const del = await prisma.userAccount.deleteMany({where: {email: {endsWith: SEED_DOMAIN}}});
	log(`Silindi: ${comps.length} yarisma, ${del.count} seed kullanici.`);
	await prisma.$disconnect();
}

async function main() {
	if (process.argv.includes('--cleanup')) return cleanup();

	// Fresh slate.
	const prev = await prisma.zktCompetition.findMany({where: {name: COMP_NAME}, select: {id: true}});
	for (const c of prev) await prisma.zktCompetition.delete({where: {id: c.id}});

	hr();
	log('LOBA MARCH ANKARA 2026 — birebir seed');
	hr();

	// 1) Users: creator (admin) + organizer + 2 delegates -------------------
	async function seedUser(email: string, first: string, last: string, country = 'TR', admin = false) {
		return prisma.userAccount.upsert({
			where: {email},
			update: {},
			create: {
				email,
				first_name: first,
				last_name: last,
				join_ip: '127.0.0.1',
				join_country: country,
				username: email.split('@')[0],
				verified: true,
				email_verified: true,
				admin,
			},
		});
	}
	const creator = await seedUser('loba-admin' + SEED_DOMAIN, 'Loba', 'Admin', 'TR', true);
	const organizer = await seedUser('iskender' + SEED_DOMAIN, 'İskender', 'Aznavur');
	const delegate1 = await seedUser('ahmet-delege' + SEED_DOMAIN, 'Ahmet Çınar', 'Ablak');
	const delegate2 = await seedUser('omer' + SEED_DOMAIN, 'Ömer', 'Çetinkaya');
	log('1) Kullanici: creator + 1 organizator + 2 delege olusturuldu.');

	// 2) Competition + events (auto Round 1 per event) ----------------------
	const comp = await createZktCompetitionWithEvents({
		createdById: creator.id,
		name: COMP_NAME,
		shortName: 'LobaMarchAnkara2026',
		description: DESCRIPTION,
		dateStart: new Date('2026-03-07T00:00:00+03:00'),
		dateEnd: new Date('2026-03-08T00:00:00+03:00'),
		location: 'Ankara, Turkey',
		locationAddress:
			'Loba Coffee & Bakery Ankara Çukurambar — Farilya Pera Apartmanı, Çukurambar Mahallesi, Yüzüncüyıl, Hasan Celal Güzel Cd. 12/18, 06530 Çankaya/Ankara — Kat 2 / 2nd Floor',
		latitude: 39.9035,
		longitude: 32.8278,
		contact: 'İskender Aznavur — +90 507 587 3376',
		competitorLimit: 100,
		visibility: 'PUBLIC',
		guestsEnabled: true,
		mainEventId: '333',
		registrationOpensAt: new Date('2026-02-06T15:00:00+03:00'),
		registrationClosesAt: new Date('2026-03-06T18:00:00+03:00'),
		eventIds: EVENTS,
	});
	const ceByEvent: Record<string, any> = {};
	for (const ce of comp.events) ceByEvent[ce.event_id] = ce;
	log(`2) Yarisma olusturuldu: "${comp.name}" — ${EVENTS.length} kategori.`);

	// 3) Rounds: configure auto Round 1 + create R2/R3 ----------------------
	const roundsByEvent: Record<string, any[]> = {};
	for (const ev of EVENTS) {
		const cfgs = ROUND_CONFIG[ev];
		const ce = ceByEvent[ev];
		const rounds: any[] = [];
		for (let i = 0; i < cfgs.length; i++) {
			const c = cfgs[i];
			const data = {
				format: 'AO5' as const,
				time_limit_cs: c.tl,
				cutoff_cs: c.cutoffCs ?? null,
				cutoff_attempts: c.cutoffAtt ?? null,
				advancement_type: (c.advType ?? null) as any,
				advancement_level: c.advLevel ?? null,
			};
			if (i === 0) {
				// auto-created Round 1
				const r1 = ce.rounds.find((r: any) => r.round_number === 1);
				rounds.push(await prisma.zktRound.update({where: {id: r1.id}, data}));
			} else {
				rounds.push(
					await prisma.zktRound.create({
						data: {comp_event_id: ce.id, round_number: i + 1, ...data},
					})
				);
			}
		}
		roundsByEvent[ev] = rounds;
	}
	log('3) Turlar yapilandirildi (format/limit/cutoff/ilerleme).');

	// 4) Custom tabs --------------------------------------------------------
	const tabs: Array<[string, string]> = [
		['Misafir / Guests', TAB_GUESTS],
		['Organizasyon Ekibi / Organization Team', TAB_ORG],
		['SSS / FAQ', TAB_FAQ],
		['Gruplar / Groups', TAB_GROUPS],
	];
	for (let i = 0; i < tabs.length; i++) {
		await prisma.zktCompTab.create({
			data: {competition_id: comp.id, title: tabs[i][0], content: tabs[i][1], tab_order: i},
		});
	}
	log(`4) ${tabs.length} ozel sekme eklendi (Misafir/Organizasyon/SSS/Gruplar).`);

	// 5) Schedule -----------------------------------------------------------
	for (const it of SCHEDULE) {
		await prisma.zktScheduleItem.create({
			data: {competition_id: comp.id, title: it.title, start_time: it.s, end_time: it.e},
		});
	}
	log(`5) Program: ${SCHEDULE.length} satir (2 gun) eklendi.`);

	// 6) Delegates + organizer ----------------------------------------------
	await prisma.zktCompOrganizer.create({data: {competition_id: comp.id, user_id: organizer.id}});
	await prisma.zktCompDelegate.create({data: {competition_id: comp.id, user_id: delegate1.id}});
	await prisma.zktCompDelegate.create({data: {competition_id: comp.id, user_id: delegate2.id}});
	log('6) Organizator (İskender) + 2 delege (Ahmet, Ömer) atandi.');

	// 7) 59 ghost competitors -----------------------------------------------
	const compEventIds = EVENTS.map((e) => ceByEvent[e].id);
	const people: Array<{first: string; last: string; country: string; eventIds: string[]; skill: number}> = [];
	// Real names: strong skill, registered to ALL events (so every event winner
	// is guaranteed present in the event they win on the WCA page).
	for (const [first, last, country] of REAL_NAMES) {
		people.push({first, last, country, eventIds: [...compEventIds], skill: 0.55 + Math.random() * 0.2});
	}
	// Filler names: 54 competitors, 2-4 random events.
	for (let i = 0; i < 54; i++) {
		const first = FILLER_FIRST[i % FILLER_FIRST.length];
		const last = FILLER_LAST[i % FILLER_LAST.length];
		const evs = [...compEventIds].sort(() => Math.random() - 0.5).slice(0, randInt(2, 4));
		people.push({first, last, country: 'TR', eventIds: evs, skill: 0.8 + Math.random() * 0.7});
	}
	const persons = await importZktCompetitors(
		comp.id,
		people.map((p) => ({
			firstName: p.first,
			lastName: p.last,
			country: p.country,
			eventIds: p.eventIds,
		}))
	);
	// Map person id -> {skill, key} and per-event registered person ids.
	const personMeta = new Map<string, {skill: number; key: string}>();
	for (let i = 0; i < persons.length; i++) {
		personMeta.set(persons[i].id, {skill: people[i].skill, key: nameKey(people[i].first, people[i].last)});
	}
	log(`7) ${persons.length} hayalet yarismaci ice aktarildi (5 gercek + 54 dolgu).`);

	// 8) Run every event: per round → ACTIVE → enter results → finalize -----
	await prisma.zktCompetition.update({where: {id: comp.id}, data: {status: 'ONGOING'}});
	for (const ev of EVENTS) {
		const rounds = roundsByEvent[ev];
		for (let ri = 0; ri < rounds.length; ri++) {
			const round = rounds[ri];
			const isFinal = ri === rounds.length - 1;
			await prisma.zktRound.update({where: {id: round.id}, data: {status: 'ACTIVE'}});

			// Competitors in this round: round 1 = everyone registered to the
			// event; later rounds = the carried (advancing) result rows.
			let personIds: string[];
			if (ri === 0) {
				const regs = await prisma.zktRegistration.findMany({
					where: {
						competition_id: comp.id,
						status: 'APPROVED',
						events: {some: {comp_event_id: ceByEvent[ev].id}},
					},
					select: {person_id: true},
				});
				personIds = regs.map((r) => r.person_id!).filter(Boolean);
			} else {
				const carried = await prisma.zktResult.findMany({
					where: {round_id: round.id},
					select: {person_id: true},
				});
				personIds = carried.map((r) => r.person_id!).filter(Boolean);
			}

			for (const pid of personIds) {
				const meta = personMeta.get(pid)!;
				let attempts: (number | null)[];
				const winner = WINNER_ATTEMPTS[ev];
				const isWinner = !!(isFinal && winner && meta.key === nameKey(winner.name[0], winner.name[1]));
				const isPod333 = isFinal && ev === '333' && !!PODIUM_333[meta.key];
				if (isWinner) {
					attempts = winner!.attempts; // exact WCA solves for the event winner
				} else if (isPod333) {
					attempts = PODIUM_333[meta.key]; // exact 2nd/3rd averages
				} else if (isFinal) {
					// Non-podium finalists: guaranteed slower (skill ≥ 1.4) so the
					// real podium values stay on top and match the WCA page.
					attempts = realisticTimes(ev, Math.max(meta.skill, 1.4));
				} else {
					attempts = realisticTimes(ev, meta.skill);
				}
				await upsertZktResult({
					round_id: round.id,
					person_id: pid,
					entered_by_id: creator.id,
					attempt_1: attempts[0],
					attempt_2: attempts[1],
					attempt_3: attempts[2],
					attempt_4: attempts[3],
					attempt_5: attempts[4],
				});
			}
			await finalizeRound(round.id, creator.id);
		}
		log(`   - ${EVENT_NAMES[ev]}: ${rounds.length} tur girildi + finalize.`);
	}

	// 9) Publish ------------------------------------------------------------
	await prisma.zktCompetition.update({where: {id: comp.id}, data: {status: 'FINISHED'}});
	let published = false;
	let pubMsg = '';
	try {
		await publishZktResults(comp.id);
		published = true;
	} catch (e: any) {
		pubMsg = e?.message || String(e);
	}
	log(`8) Sonuclar: ${published ? 'YAYINLANDI (PUBLISHED)' : 'YAYINLANAMADI — ' + pubMsg}`);

	hr();
	log(`Yarisma: ${comp.name}`);
	log(`Yarismaci: ${persons.length}`);
	log(`Etkinlik: ${EVENTS.length} · Ozel sekme: ${tabs.length} · Program: ${SCHEDULE.length} satir`);
	log('Temizlemek icin: npx ts-node --transpile-only scripts/seed-loba-ankara.ts --cleanup');
	hr();

	await prisma.$disconnect();
}

main().catch(async (e) => {
	console.error('SEED HATASI:', e);
	await prisma.$disconnect();
	process.exit(1);
});
