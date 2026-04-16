import {Arg, Authorized, Query, Resolver} from 'type-graphql';
import {Role} from '../middlewares/auth';
import {ZktRecord} from '../schemas/ZktCompetition.schema';
import {getAllCurrentRecords, getRecordHistory} from '../models/zkt_record';

@Resolver()
export class ZktRecordResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktRecord])
	async zktRecords() {
		return getAllCurrentRecords();
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktRecord])
	async zktRecordsForEvent(
		@Arg('eventId') eventId: string,
		@Arg('recordType') recordType: string
	) {
		if (recordType !== 'single' && recordType !== 'average') {
			return [];
		}
		return getRecordHistory(eventId, recordType);
	}
}
