import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	extensions: ['.svelte'],
	preprocess: [vitePreprocess()],
	kit: { adapter: adapter(), experimental: { remoteFunctions: true } },
	compilerOptions: { experimental: { async: true } },
	vitePlugin: {
		inspector: {
			toggleKeyCombo: 'meta-shift',
			showToggleButton: 'always',
			toggleButtonPos: 'bottom-right'
		}
	}
};

export default config;
