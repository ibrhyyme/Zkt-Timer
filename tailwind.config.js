/** @type {import('tailwindcss').Config} */

module.exports = {
	content: ['./client/**/*.{ts,tsx,js,jsx,scss,css}'],
	theme: {
		// Mirrors $breakpoints in client/styles/tokens.scss. Keep the two in sync:
		// the SCSS mixins and these utility prefixes must fire at the same width,
		// or a component styled with `@include bp-down('md')` and a sibling using
		// `md:hidden` will disagree about where the tablet band starts.
		//
		// `md` stays at Tailwind's default 768px because 92 existing class names
		// depend on it. `2xl` is nudged from 1536px to 1600px to match the token
		// scale; it has no call sites yet.
		screens: {
			xxs: '400px',
			xs: '480px',
			sm: '640px',
			md: '768px',
			lg: '1024px',
			xl: '1280px',
			'2xl': '1600px',
		},
		extend: {
			colors: {
				primary: 'rgba(var(--primary-color), <alpha-value>)',
				secondary: 'rgba(var(--secondary-color), <alpha-value>)',
				text: 'rgba(var(--text-color), <alpha-value>)',
				background: 'rgba(var(--background-color), <alpha-value>)',
				button: 'rgba(var(--button-color), <alpha-value>)',
				module: 'rgba(var(--module-color), <alpha-value>)',
				success: 'rgba(var(--success-color), <alpha-value>)',
				error: 'rgba(var(--error-color), <alpha-value>)',
				warning: 'rgba(var(--warning-color), <alpha-value>)',
				info: 'rgba(var(--info-color), <alpha-value>)',

				'tm-background': 'rgba(var(--theme-background), <alpha-value>)',
				'tmo-background': 'rgba(var(--theme-background-opposite), <alpha-value>)',
				'tm-module': 'rgba(var(--theme-module), <alpha-value>)',
				'tmo-module': 'rgba(var(--theme-module-opposite), <alpha-value>)',
				'tm-primary': 'rgba(var(--theme-primary), <alpha-value>)',
				'tmo-primary': 'rgba(var(--theme-primary-opposite), <alpha-value>)',
				'tm-secondary': 'rgba(var(--theme-secondary), <alpha-value>)',
				'tmo-secondary': 'rgba(var(--theme-secondary-opposite), <alpha-value>)',
				'tm-text': 'rgba(var(--theme-text), <alpha-value>)',
				'tmo-text': 'rgba(var(--theme-text-opposite), <alpha-value>)',
				'tm-button': 'rgba(var(--theme-button), <alpha-value>)',
				'tmo-button': 'rgba(var(--theme-button-opposite), <alpha-value>)',
			},
			boxShadow: {
				md: '0 2px 15px rgba(0, 0, 0, 0.1)',
			},
			// Mirrors $zt-radius-* in client/styles/tokens.scss: three corner sizes for the
			// whole app. Tailwind's seven defaults (2px to 24px) are folded onto them so the
			// existing `rounded-*` classes in TSX land on the same shape as the SCSS side.
			// sm = chip/badge, md = button/input/row, lg = card/modal.
			borderRadius: {
				none: '0',
				sm: '4px',
				DEFAULT: '4px',
				md: '4px',
				lg: '4px',
				xl: '14px',
				'2xl': '14px',
				'3xl': '14px',
				full: '9999px',
			},
			fontFamily: {
				label: ['Source Sans Pro', 'sans-serif'],
				roboto: ['Roboto', 'sans-serif'],
			},
		},
	},
};
