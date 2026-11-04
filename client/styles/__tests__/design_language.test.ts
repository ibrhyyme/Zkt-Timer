import fs from 'fs';
import path from 'path';

// Guard for the design language in styles/tokens.scss. The app read as AI-made because
// every page reinvented its own button, modal and card, each with a blur, a gradient or
// a glow on top. The shared primitives are now flat; these checks keep them flat and stop
// the rest of the stylesheet from growing new effects while the pages are migrated.
//
// The counts are a ratchet: they may only go down. When a migration removes blurs or
// gradients, lower the matching number here in the same change so the gain is locked in.

const CLIENT = path.resolve(__dirname, '../..');

const BASELINE = {
	scssBackdropBlur: 28,
	scssGradient: 161,
	tsxBackdropBlur: 9,
	tsxBgGradient: 3,
	tsxInlineEffect: 6,
};

function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function files(dir: string, ext: string): string[] {
	const out: string[] = [];
	for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === '@types') continue;
			out.push(...files(full, ext));
		} else if (entry.name.endsWith(ext)) {
			out.push(full);
		}
	}
	return out;
}

function count(paths: string[], re: RegExp, strip = true): number {
	let n = 0;
	for (const p of paths) {
		const src = fs.readFileSync(p, 'utf8');
		n += ((strip ? stripComments(src) : src).match(re) || []).length;
	}
	return n;
}

const read = (rel: string) => stripComments(fs.readFileSync(path.join(CLIENT, rel), 'utf8'));

const scss = files(CLIENT, '.scss');
const tsx = files(CLIENT, '.tsx');

describe('design language: shared primitives stay flat', () => {
	const PRIMITIVES = [
		'components/common/button/Button.scss',
		'components/common/modal/Modal.scss',
		'components/common/modal/modal_header/ModalHeader.scss',
		'components/common/icon_button/IconButton.scss',
		'components/common/choice_group/ChoiceGroup.scss',
		'components/common/tab_bar/TabBar.scss',
	];

	it.each(PRIMITIVES)('%s has no blur, gradient or hand-written radius', (rel) => {
		const src = read(rel);
		expect(src).not.toMatch(/backdrop-filter\s*:\s*blur/);
		expect(src).not.toMatch(/(linear|radial)-gradient\(/);
		// Corners come from $zt-radius-*; 0 is allowed for the full-screen states.
		const radii = src.match(/border-radius\s*:\s*[^;]+/g) || [];
		for (const decl of radii) {
			expect(decl).toMatch(/\$zt-radius-|:\s*0(\s|!|$)/);
		}
	});

	it('dark-glass no longer blurs', () => {
		const config = read('styles/config.scss');
		const mixin = config.slice(config.indexOf('@mixin dark-glass'));
		expect(mixin.slice(0, mixin.indexOf('}'))).not.toMatch(/backdrop-filter/);
	});

	it('the nav pill is the user accent, not a fixed gradient', () => {
		const nav = read('components/layout/header_nav/HeaderNav.scss');
		const pill = nav.slice(nav.indexOf('&__pill'));
		expect(pill.slice(0, pill.indexOf('}'))).not.toMatch(/gradient|box-shadow/);
	});
});

describe('design language: every menu has one source', () => {
	const MENUS = [
		'components/timer/header_control/FancyDropdown.scss',
		'components/common/inputs/dropdown/Dropdown.scss',
		'components/common/dropdown/OldDropdown.scss',
		'components/layout/nav/account_dropdown/AccountDropdown.scss',
		'components/solves/cube_filter/CubeFilterPicker.scss',
		'components/timer/tiles/TileMenu.scss',
		'components/quick-controls/SettingsDropdown.scss',
		'components/rooms/EditRoomDropdown.scss',
		'components/admin/Admin.scss',
		'components/admin/site_config/FeatureAccessControl.scss',
		'components/battle/Battle.scss',
		'components/rooms/RoomCard.scss',
		'components/common/action_menu/ActionMenu.scss',
		'components/rooms/FriendlyRoom.scss',
		'components/solves/Solves.scss',
		'components/common/color_picker/ColorPicker.scss',
	];

	it.each(MENUS)('%s takes its panel from zt-menu-panel', (rel) => {
		expect(read(rel)).toMatch(/@include zt-menu-panel/);
	});

	it('no native select: the browser draws its list, so it can never match the menus', () => {
		expect(count(tsx, /<select[\s>]/g)).toBe(0);
	});

	it('the set screens open the shared action menu, not a modal of their own', () => {
		expect(read('components/trainer/sets/set_actions.tsx')).toMatch(/useActionMenu/);
		expect(read('components/trainer/sets/parts.tsx')).not.toMatch(/function ActionSheet/);
	});

	it('the timer type menu is a FancyDropdown, not a copy of it', () => {
		const src = read('components/timer/header_control/TimerTypePicker.tsx');
		expect(src).toMatch(/FancyDropdown/);
		expect(src).not.toMatch(/@radix-ui/);
	});
});

describe('design language: phone menus stay small', () => {
	it('no menu spreads across a phone', () => {
		const panel = read('components/timer/header_control/FancyDropdown.scss');
		expect(panel).not.toMatch(/100vw - #\{2/);
		expect(panel).toMatch(/\$zt-menu-max-w-phone/);
		expect(panel).toMatch(/\$zt-menu-max-h-phone/);
	});
});

describe('design language: framed pages share one sheet', () => {
	it.each([
		'components/settings/page/SettingsPage.scss',
		'components/account/Account.scss',
		'components/help/Help.scss',
	])('%s takes its frame from zt-sheet', (rel) => {
		const src = read(rel);
		expect(src).toMatch(/@include zt-sheet;/);
		expect(src).toMatch(/@include zt-sheet-band;/);
	});

	it('the sheet has one fixed height: its content scrolls, not the page', () => {
		const tokens = read('styles/tokens.scss');
		const mixin = tokens.slice(tokens.indexOf('@mixin zt-sheet {'));
		expect(mixin.slice(0, mixin.indexOf('}'))).toMatch(/height: \$zt-sheet-height/);
	});

	it.each([
		'components/settings/page/SettingsPage.scss',
		'components/account/Account.scss',
		'components/help/Help.scss',
	])('%s scrolls its content column', (rel) => {
		expect(read(rel)).toMatch(/@include zt-sheet-content;/);
	});
});

describe('design language: no new effects (ratchet)', () => {
	it('backdrop blur in SCSS does not grow', () => {
		expect(count(scss, /backdrop-filter\s*:\s*blur/g)).toBeLessThanOrEqual(BASELINE.scssBackdropBlur);
	});

	it('gradients in SCSS do not grow', () => {
		expect(count(scss, /(linear|radial)-gradient\(/g)).toBeLessThanOrEqual(BASELINE.scssGradient);
	});

	it('Tailwind backdrop-blur in TSX does not grow', () => {
		expect(count(tsx, /\bbackdrop-blur(-[a-z0-9]+)?\b/g, false)).toBeLessThanOrEqual(BASELINE.tsxBackdropBlur);
	});

	it('Tailwind bg-gradient in TSX does not grow', () => {
		expect(count(tsx, /\bbg-gradient-to-[a-z]+\b/g, false)).toBeLessThanOrEqual(BASELINE.tsxBgGradient);
	});

	it('inline blur or gradient styles in TSX do not grow', () => {
		expect(count(tsx, /backdropFilter|linear-gradient\(/g, false)).toBeLessThanOrEqual(BASELINE.tsxInlineEffect);
	});
});
