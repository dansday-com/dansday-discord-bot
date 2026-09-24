import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';

function required(env: Record<string, string>, key: string): string {
	const value = env[key]?.trim();
	if (!value) throw new Error(`Missing ${key} environment variable`);
	return value;
}

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	return {
		plugins: [tailwindcss(), sveltekit()],
		define: {
			__APP_NAME__: JSON.stringify(required(env, 'APP_NAME')),
			__APP_URL__: JSON.stringify(required(env, 'APP_URL'))
		},
		server: {
			host: '0.0.0.0',
			port: 3000,
			watch: { usePolling: true }
		}
	};
});
