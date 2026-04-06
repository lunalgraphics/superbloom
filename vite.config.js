import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
	plugins: [sveltekit()],
	define: {
		__IS_PHOTOSHOP_PLUGIN__: mode === 'photoshop'
	}
}));
