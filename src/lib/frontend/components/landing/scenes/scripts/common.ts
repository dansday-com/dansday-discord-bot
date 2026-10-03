import { APP_DOMAIN, APP_NAME } from '$lib/frontend/panelServer.js';
import type { Person, Scene } from '../types.js';

export const avatar = (n: number) => `https://cdn.discordapp.com/embed/avatars/${n}.png`;

export const BOT: Person = { name: APP_NAME, avatar: '/favicon-96x96.png', app: true };

export const FOOTER = `Powered by ${APP_DOMAIN} ${new Date().getFullYear()}`;

export const at = (time: string) => `Today at ${time}`;

export function defineScene(scene: Scene): Scene {
	return { ...scene, events: [...scene.events].sort((a, b) => a.at - b.at) };
}
