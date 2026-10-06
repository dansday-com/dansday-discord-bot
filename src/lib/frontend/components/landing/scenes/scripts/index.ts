import { inviteShare, steal, xpCall } from './beyond.js';
import { member, setup } from './menu.js';
import { account, themes, voice } from './web.js';

export const ESSENTIAL_SCENES = [setup, member, xpCall, inviteShare];
export const BEYOND_SCENES = [steal, voice, account, themes];
