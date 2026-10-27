import WcaResultEnteredNotification from '../wca_result_entered';
import WcaRoundFinishedNotification from '../wca_round_finished';
import WcaCompetitionCountdownNotification from '../wca_competition_countdown';
import WcaFollowResultEnteredNotification from '../wca_follow_result_entered';
import WcaFollowRoundFinishedNotification from '../wca_follow_round_finished';
import WcaFollowCountdownNotification from '../wca_follow_countdown';

// A ZKT competition goes through the same live-results and countdown
// notifications as a WCA one. The category is the heading of the inbox row, so
// it has to name the federation that runs the competition. Constructors and
// categoryName are pure; send() is never called.
const stubInput: any = {user: {id: 'u1'}, triggeringUser: {id: 'u1'}, sendEmail: false};

const meta = (competitionId: string): any => ({
	competitionId,
	competitionName: 'Ornek',
	eventId: '333',
	eventName: '3x3',
	roundNumber: 1,
	resultText: '12.81',
	ranking: 10,
	advancing: false,
	advancingQuestionable: false,
	isFinal: true,
	followedName: 'Ornek Yarismaci',
	daysBefore: 3,
	locale: 'tr',
});

const kinds: Array<[string, (m: any) => {categoryName(): string}]> = [
	['result entered', (m) => new WcaResultEnteredNotification(stubInput, m)],
	['round finished', (m) => new WcaRoundFinishedNotification(stubInput, m)],
	['countdown', (m) => new WcaCompetitionCountdownNotification(stubInput, m)],
	['follow result entered', (m) => new WcaFollowResultEnteredNotification(stubInput, m)],
	['follow round finished', (m) => new WcaFollowRoundFinishedNotification(stubInput, m)],
	['follow countdown', (m) => new WcaFollowCountdownNotification(stubInput, m)],
];

describe('live results and countdown notifications: inbox category', () => {
	it.each(kinds)('%s on a ZKT competition is filed under ZKT', (_name, build) => {
		expect(build(meta('zkt-ZKTBacktoSchoolIstanbul2026')).categoryName()).toBe('ZKT');
	});

	it.each(kinds)('%s on a WCA competition stays under WCA', (_name, build) => {
		expect(build(meta('Test2026')).categoryName()).toBe('WCA');
	});
});
