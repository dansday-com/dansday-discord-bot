export type Attempt<T> = { ok: true; value: T } | { ok: false; error: unknown };

export async function attempt<T>(run: () => T | Promise<T>): Promise<Attempt<T>> {
	try {
		return { ok: true, value: await run() };
	} catch (error) {
		return { ok: false, error };
	}
}

export function attemptSync<T>(run: () => T): Attempt<T> {
	try {
		return { ok: true, value: run() };
	} catch (error) {
		return { ok: false, error };
	}
}
