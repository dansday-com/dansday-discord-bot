import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

process.env.APP_NAME = 'Test Bot';
process.env.APP_URL = 'https://example.test';

const LIB = new URL('../src/lib/', import.meta.url);

function sourceOf(url: URL): URL | null {
	if (!url.pathname.endsWith('.js')) {
		return null;
	}
	const source = new URL(url.href.replace(/\.js$/, '.ts'));
	return existsSync(fileURLToPath(source)) ? source : null;
}

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier.startsWith('$lib/')) {
			const target = new URL(specifier.slice(5), LIB);
			return nextResolve((sourceOf(target) ?? target).href, context);
		}
		const parent = context.parentURL;
		if (parent?.startsWith('file:') && !parent.includes('/node_modules/') && specifier.startsWith('.')) {
			const source = sourceOf(new URL(specifier, parent));
			if (source) {
				return nextResolve(source.href, context);
			}
		}
		return nextResolve(specifier, context);
	}
});
