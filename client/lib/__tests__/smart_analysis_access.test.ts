import {canSeeSmartAnalysis} from '../pro';

// The client side of the rule solveReplayData applies on the server: a smart solve's analysis
// opens on the viewer's Pro or the owner's. The owner here is the public user a shared solve
// carries, which has no expiry dates; the server checks those.

const pro: any = {id: 'a', is_pro: true, is_premium: false};
const premium: any = {id: 'b', is_pro: false, is_premium: true};
const basic: any = {id: 'c', is_pro: false, is_premium: false};

describe('canSeeSmartAnalysis', () => {
	const before = process.env.PRO_ENABLED;
	beforeEach(() => {
		process.env.PRO_ENABLED = 'true';
	});
	afterAll(() => {
		process.env.PRO_ENABLED = before;
	});

	it("opens a Pro or Premium member's solve to a Basic or signed-out viewer", () => {
		expect(canSeeSmartAnalysis(basic, pro)).toBe(true);
		expect(canSeeSmartAnalysis(undefined, pro)).toBe(true);
		expect(canSeeSmartAnalysis(undefined, premium)).toBe(true);
	});

	it('opens any solve to a Pro viewer', () => {
		expect(canSeeSmartAnalysis(pro, basic)).toBe(true);
		expect(canSeeSmartAnalysis(premium, undefined)).toBe(true);
	});

	it('keeps a Basic member locked out of their own solves, shared or not', () => {
		expect(canSeeSmartAnalysis(basic, basic)).toBe(false);
		// A solve saved on this device carries no user; the viewer's own Pro decides.
		expect(canSeeSmartAnalysis(basic, undefined)).toBe(false);
		expect(canSeeSmartAnalysis(undefined, basic)).toBe(false);
	});

	it('opens everything while Pro is off', () => {
		process.env.PRO_ENABLED = 'false';
		expect(canSeeSmartAnalysis(undefined, undefined)).toBe(true);
	});
});
