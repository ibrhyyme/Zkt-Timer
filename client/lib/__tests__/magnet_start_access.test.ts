import {canUseMagnetStart} from '../magnet-start-access';

const basic = {is_pro: false, is_premium: false} as any;
const pro = {is_pro: true, is_premium: false} as any;
const premium = {is_pro: false, is_premium: true} as any;
const admin = {admin: true, is_pro: false, is_premium: false} as any;

describe('canUseMagnetStart', () => {
	const original = process.env.PRO_ENABLED;
	afterEach(() => {
		process.env.PRO_ENABLED = original;
	});

	it('is a Pro feature while Pro is enabled', () => {
		process.env.PRO_ENABLED = 'true';
		expect(canUseMagnetStart(pro)).toBe(true);
		expect(canUseMagnetStart(premium)).toBe(true);
		expect(canUseMagnetStart(basic)).toBe(false);
		expect(canUseMagnetStart(undefined)).toBe(false);
		expect(canUseMagnetStart(null)).toBe(false);
	});

	it('stays open for admins without a subscription (field-test panel, telemetry)', () => {
		process.env.PRO_ENABLED = 'true';
		expect(canUseMagnetStart(admin)).toBe(true);
	});

	it('is open to everyone when Pro is switched off, like every other Pro gate', () => {
		process.env.PRO_ENABLED = 'false';
		expect(canUseMagnetStart(basic)).toBe(true);
		expect(canUseMagnetStart(undefined)).toBe(true);
	});
});
