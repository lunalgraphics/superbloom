import adapter from '@sveltejs/adapter-static';

let outDir = 'build';
if (process.env.npm_lifecycle_script?.includes('--mode photoshop')) {
	outDir = 'photoshop-plugin/webview-contents';
}
else if (process.env.npm_lifecycle_script?.includes('--mode electron')) {
	outDir = 'electron-app/app'
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://kit.svelte.dev/docs/adapters for more information about adapters.
		adapter: adapter({
			pages: outDir,
			assets: outDir,
			fallback: null,
			precompress: false
		}),
	}
};

export default config;
