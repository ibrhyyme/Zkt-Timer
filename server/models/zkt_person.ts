import {getPrisma} from '../database';

export interface ZktPersonRow {
	firstName: string;
	lastName: string;
	country?: string | null;
	wcaId?: string | null;
	externalId?: string | null;
	gender?: string | null;
	eventIds: string[];
}

/**
 * Bulk-import account-less ("ghost") competitors into a competition: one
 * ZktPerson + an APPROVED registration + registration events per row. Backs
 * both CSV/Excel import and single manual add. No UserAccount is touched.
 */
export async function importZktCompetitors(competitionId: string, rows: ZktPersonRow[]) {
	const prisma = getPrisma();
	const compEvents = await prisma.zktCompEvent.findMany({
		where: {competition_id: competitionId},
	});
	const validEventIds = new Set(compEvents.map((e) => e.id));

	const created = [];
	for (const row of rows) {
		const firstName = (row.firstName || '').trim();
		const lastName = (row.lastName || '').trim();
		if (!firstName && !lastName) continue; // skip empty rows (blank CSV lines)

		const person = await prisma.zktPerson.create({
			data: {
				competition_id: competitionId,
				first_name: firstName,
				last_name: lastName,
				country_code: row.country?.trim() || 'TR',
				wca_id: row.wcaId?.trim() || null,
				external_id: row.externalId?.trim() || null,
				gender: row.gender?.trim() || null,
			},
		});
		const registration = await prisma.zktRegistration.create({
			data: {
				competition_id: competitionId,
				person_id: person.id,
				status: 'APPROVED',
			},
		});
		const eventIds = (row.eventIds || []).filter((e) => validEventIds.has(e));
		for (const eid of eventIds) {
			await prisma.zktRegistrationEvent.create({
				data: {registration_id: registration.id, comp_event_id: eid},
			});
		}
		created.push(person);
	}
	return created;
}

/** Single manual add — thin wrapper over the bulk importer. */
export async function createZktPerson(competitionId: string, row: ZktPersonRow) {
	const [person] = await importZktCompetitors(competitionId, [row]);
	return person;
}

export async function updateZktPerson(
	personId: string,
	data: {
		firstName?: string;
		lastName?: string;
		country?: string | null;
		wcaId?: string | null;
		externalId?: string | null;
		gender?: string | null;
		eventIds?: string[];
	}
) {
	const prisma = getPrisma();
	const updates: any = {};
	if (data.firstName !== undefined) updates.first_name = data.firstName.trim();
	if (data.lastName !== undefined) updates.last_name = data.lastName.trim();
	if (data.country !== undefined) updates.country_code = data.country?.trim() || 'TR';
	if (data.wcaId !== undefined) updates.wca_id = data.wcaId?.trim() || null;
	if (data.externalId !== undefined) updates.external_id = data.externalId?.trim() || null;
	if (data.gender !== undefined) updates.gender = data.gender?.trim() || null;

	const person = await prisma.zktPerson.update({where: {id: personId}, data: updates});

	// Event changes flow through the person's single registration row.
	if (data.eventIds) {
		const reg = await prisma.zktRegistration.findFirst({where: {person_id: personId}});
		if (reg) {
			const compEvents = await prisma.zktCompEvent.findMany({
				where: {competition_id: person.competition_id},
			});
			const valid = new Set(compEvents.map((e) => e.id));
			await prisma.zktRegistrationEvent.deleteMany({where: {registration_id: reg.id}});
			for (const eid of data.eventIds.filter((e) => valid.has(e))) {
				await prisma.zktRegistrationEvent.create({
					data: {registration_id: reg.id, comp_event_id: eid},
				});
			}
		}
	}
	return person;
}

/** Cascade-deletes the person's registration, results, and assignments. */
export async function deleteZktPerson(personId: string) {
	await getPrisma().zktPerson.delete({where: {id: personId}});
}
