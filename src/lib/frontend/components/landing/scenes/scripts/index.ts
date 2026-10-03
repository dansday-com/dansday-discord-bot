import { ai, roblox, steal } from './beyond.js';
import { alerts, giveaways, moderation, welcome } from './essentials.js';
import { leveling } from './leveling.js';

export const ESSENTIAL_SCENES = [leveling, welcome, moderation, giveaways, alerts];
export const BEYOND_SCENES = [steal, ai, roblox];
