/**
 * Test script: testerrrrr hesabina 2018ABLA01 WCA verilerini yazar.
 *
 * Kullanim:
 *   npx ts-node scripts/seed-wca-test.ts
 *
 * Bu script:
 * 1. testerrrrr kullanicisini bulur
 * 2. Integration kaydi yoksa olusturur, varsa gunceller
 * 3. WCA API'den 2018ABLA01 verilerini ceker
 * 4. WcaRecord kayitlarini olusturur/gunceller
 * 5. Integration metadata (yarisma, madalya, rekor) kaydeder
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const WCA_ID = '2018ABLA01';
const TEST_USERNAME = 'testerrrrr';

async function main() {
	// 1. Test kullaniciyi bul
	const user = await prisma.userAccount.findFirst({
		where: { username: TEST_USERNAME },
	});

	if (!user) {
		console.error(`Kullanici "${TEST_USERNAME}" bulunamadi!`);
		process.exit(1);
	}

	console.log(`Kullanici bulundu: ${user.username} (${user.id})`);

	// 2. WCA API'den veri cek
	console.log(`WCA API'den ${WCA_ID} verileri cekiliyor...`);
	const res = await axios.get(`https://www.worldcubeassociation.org/api/v0/persons/${WCA_ID}`);
	const data = res.data;

	console.log(`Yarisma: ${data.competition_count}, Madalya: ${data.medals.total}, NR: ${data.records.national}`);

	// 3. Integration kaydi olustur/guncelle
	let integration = await prisma.integration.findFirst({
		where: { user_id: user.id, service_name: 'wca' },
	});

	const integrationData = {
		service_name: 'wca',
		auth_token: 'test-token',
		refresh_token: 'test-refresh',
		auth_expires_at: BigInt(Date.now() + 86400000),
		wca_id: WCA_ID,
		wca_country_iso2: data.person?.country_iso2 || 'TR',
		wca_competition_count: data.competition_count,
		wca_medal_gold: data.medals.gold,
		wca_medal_silver: data.medals.silver,
		wca_medal_bronze: data.medals.bronze,
		wca_record_nr: data.records.national,
		wca_record_cr: data.records.continental,
		wca_record_wr: data.records.world,
	};

	if (integration) {
		integration = await prisma.integration.update({
			where: { id: integration.id },
			data: integrationData,
		});
		console.log('Integration guncellendi.');
	} else {
		integration = await prisma.integration.create({
			data: {
				user_id: user.id,
				...integrationData,
			},
		});
		console.log('Integration olusturuldu.');
	}

	// 4. WcaRecord kayitlari
	const supportedEvents = [
		'333', '222', '444', '555', '666', '777',
		'333bf', '333fm', '333oh', '333ft',
		'minx', 'pyram', 'clock', 'skewb', 'sq1',
		'444bf', '555bf', '333mbf',
	];

	let recordCount = 0;
	for (const eventCode of supportedEvents) {
		const pr = data.personal_records?.[eventCode];
		if (!pr || (!pr.single && !pr.average)) continue;

		const recordData = {
			user_id: user.id,
			integration_id: integration.id,
			wca_event: eventCode,
			single_record: pr.single?.best || null,
			average_record: pr.average?.best || null,
			single_world_rank: pr.single?.world_rank || null,
			average_world_rank: pr.average?.world_rank || null,
			single_continent_rank: pr.single?.continent_rank || null,
			average_continent_rank: pr.average?.continent_rank || null,
			single_country_rank: pr.single?.country_rank || null,
			average_country_rank: pr.average?.country_rank || null,
			fetched_at: new Date(),
			updated_at: new Date(),
		};

		await prisma.wcaRecord.upsert({
			where: {
				user_id_wca_event: {
					user_id: user.id,
					wca_event: eventCode,
				},
			},
			update: { ...recordData, published: true },
			create: { ...recordData, published: true, created_at: new Date() },
		});

		recordCount++;
	}

	console.log(`${recordCount} WCA rekor kaydedildi (hepsi published).`);
	console.log('Tamam! Simdi /user/testerrrrr sayfasini kontrol et.');
}

main()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
