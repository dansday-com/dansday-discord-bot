import { inviteShare, roblox, steal } from './beyond.js';
import { alerts, giveaways, moderation, welcome } from './essentials.js';
import { leveling } from './leveling.js';
import { member, setup, staff } from './menu.js';
import { account, dashboard, publicStats, tasks, themes, voice } from './web.js';

export const ESSENTIAL_SCENES = [setup, member, inviteShare];
export const BEYOND_SCENES = [steal, voice, account, themes];
