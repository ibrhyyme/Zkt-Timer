import {extractCountry} from '../request';

// Signup records the visitor's country from Cloudflare's CF-IPCountry header
// instead of sending the IP address to a geolocation service.
describe('extractCountry', () => {
	it('reads the ISO code Cloudflare sends', () => {
		expect(extractCountry({headers: {'cf-ipcountry': 'TR'}})).toBe('TR');
		expect(extractCountry({headers: {'cf-ipcountry': ' de '}})).toBe('DE');
	});

	it('maps unknown and Tor to NONE, like a failed lookup did', () => {
		expect(extractCountry({headers: {'cf-ipcountry': 'XX'}})).toBe('NONE');
		expect(extractCountry({headers: {'cf-ipcountry': 'T1'}})).toBe('NONE');
	});

	it('is NONE when the header is missing or malformed', () => {
		expect(extractCountry({headers: {}})).toBe('NONE');
		expect(extractCountry(undefined)).toBe('NONE');
		expect(extractCountry({headers: {'cf-ipcountry': 'TUR'}})).toBe('NONE');
		expect(extractCountry({headers: {'cf-ipcountry': ['FR', 'DE']}})).toBe('FR');
	});
});
