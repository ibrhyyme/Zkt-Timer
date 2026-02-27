require('dotenv').config();
const postCssPlugin = require('esbuild-style-plugin');
const {sassPlugin} = require('esbuild-sass-plugin');

const nodeEnv = process.env.NODE_ENV || 'development';
const deploying = process.env.DEPLOYING;
const releaseName = process.env.RELEASE_NAME || '1.0';
const deploymentId = process.env.DEPLOYMENT_ID || 'app';
const resourceBaseUri = process.env.RESOURCES_BASE_URI || '/public';

const dev = nodeEnv === 'development';

let watch = {
	onRebuild(error, result) {
		if (error) {
			console.error('watch build failed:', error);
		}
	},
};

if (deploying) {
	watch = false;
}

// Solver Web Worker build (cubejs Kociemba - runs off main thread)
require('esbuild').build({
	entryPoints: ['client/util/solver-worker-entry.ts'],
	outfile: 'dist/solver-worker.js',
	bundle: true,
	logLevel: 'error',
	minify: !dev,
	resolveExtensions: ['.ts', '.js'],
	format: 'iife',
	loader: {'.js': 'jsx'},
}).catch((err) => {
	console.error('Solver worker build failed:', err);
});

require('esbuild')
	.build({
		entryPoints: ['client/components/App.tsx'],
		outfile: `dist/${deploymentId}.min.js`,
		bundle: true,
		logLevel: 'error',
		minify: !dev,
		resolveExtensions: ['.tsx', '.ts', '.jsx', '.js'],
		define: {
			'process.env.RESOURCES_BASE_URI': JSON.stringify(resourceBaseUri),
			'process.env.RELEASE_NAME': JSON.stringify(releaseName),
			'process.env.ENV': JSON.stringify(nodeEnv),
			'process.env.NODE_ENV': JSON.stringify(nodeEnv),
			'process.env.BASE_URI': JSON.stringify(process.env.BASE_URI || 'http://localhost:3000'),
			'process.env.PRO_ENABLED': JSON.stringify(process.env.PRO_ENABLED || 'false'),
			'process.env.FIREBASE_WEB_API_KEY': JSON.stringify(process.env.FIREBASE_WEB_API_KEY || ''),
			'process.env.FIREBASE_PROJECT_ID': JSON.stringify(process.env.FIREBASE_PROJECT_ID || ''),
			'process.env.FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(process.env.FIREBASE_MESSAGING_SENDER_ID || ''),
			'process.env.FIREBASE_APP_ID': JSON.stringify(process.env.FIREBASE_APP_ID || ''),
			'process.env.FIREBASE_VAPID_KEY': JSON.stringify(process.env.FIREBASE_VAPID_KEY || ''),
		},
		loader: {'.js': 'jsx'},
		plugins: [
			postCssPlugin({
				postcss: {
					plugins: [require('tailwindcss'), require('autoprefixer')],
				},
			}),
		],
		watch,
	})
	.then((result) => {
		console.info('Watching...');

		// Temiz kapanma - zombie süreç bırakmaz
		const cleanup = () => {
			if (result.stop) {
				result.stop();
			}
			process.exit(0);
		};

		process.on('SIGINT', cleanup);
		process.on('SIGTERM', cleanup);
	})
	.catch((err) => {
		console.error('Build failed:', err);
		process.exit(1);
	});
