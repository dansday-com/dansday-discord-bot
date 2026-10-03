import { roblox, steal } from './beyond.js';
import { alerts, giveaways, moderation, welcome } from './essentials.js';
import { leveling } from './leveling.js';
import { account, dashboard, voice } from './web.js';

export const ESSENTIAL_SCENES = [leveling, dashboard, welcome, moderation, giveaways, alerts];
export const BEYOND_SCENES = [voice, account, steal, roblox];
