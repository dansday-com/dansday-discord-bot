import { APP_DOMAIN, APP_NAME } from '$lib/backend/panelServer.js';
import type { Person, Scene } from '../types.js';
import { defaultAvatarUrl } from '$lib/discordAvatars.js';

export const avatar = defaultAvatarUrl;

const DEFAULT_AVATAR_OF = { kai: 0, mira: 2, rin: 3, jun: 4 };

export const CAST = {
	kai: { name: 'Kai', avatar: avatar(DEFAULT_AVATAR_OF.kai) },
	mira: { name: 'Mira', avatar: avatar(DEFAULT_AVATAR_OF.mira) },
	rin: { name: 'Rin', avatar: avatar(DEFAULT_AVATAR_OF.rin) },
	jun: { name: 'Jun', avatar: avatar(DEFAULT_AVATAR_OF.jun) }
} satisfies Record<string, Person>;

export const BOT: Person = { name: APP_NAME, avatar: '/favicon-96x96.png', app: true };

export const FOOTER = `Powered by ${APP_DOMAIN} ${new Date().getFullYear()}`;

export const at = (time: string) => `Today at ${time}`;

export function defineScene(scene: Scene): Scene {
	return { ...scene, events: [...(scene.events ?? [])].sort((a, b) => a.at - b.at) };
}
