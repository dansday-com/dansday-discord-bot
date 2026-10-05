import { inviteShare, steal } from './beyond.js';
import { member, setup } from './menu.js';
import { account, themes, voice } from './web.js';

export const ESSENTIAL_SCENES = [setup, member, inviteShare];
export const BEYOND_SCENES = [steal, voice, account, themes];
