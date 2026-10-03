import type { Component } from 'svelte';

export type Person = { name: string; avatar: string; app?: boolean };

export type SceneButton = { label: string; link?: boolean; tone?: 'grey' | 'blurple' | 'green' | 'red'; pressAt?: number };

export type SceneArt = { background: string; icon?: string; badge?: string };

export type SceneEmbed = {
	color: string;
	author?: string;
	title?: string;
	description?: string;
	fields?: { name: string; value: string; inline?: boolean }[];
	footer?: string;
	thumbnail?: string;
	thumbnailArt?: SceneArt;
	image?: SceneArt;
	buttons?: SceneButton[];
};

export type ScenePop = { text: string; tone: 'gold' | 'red' | 'green' };

export type SceneEvent = {
	id: string;
	at: number;
	who: string;
	time: string;
	text?: string;
	typeFrom?: number;
	embed?: SceneEmbed;
	pop?: ScenePop;
	ephemeral?: boolean;
	replyTo?: string;
	newGroup?: boolean;
};

export type ScenePatch = { at: number; id: string; text?: string; embed?: Partial<SceneEmbed> };

export type SceneStep = { from: number; to: number; title: string; desc: string };

export type SceneScreenProps = { t: number; still: boolean };

export type Scene = {
	id: string;
	label: string;
	icon: string;
	tagline?: string;
	screen?: Component<SceneScreenProps>;
	url?: string;
	server?: string;
	channel?: string;
	duration: number;
	rest: number;
	people?: Record<string, Person>;
	roles?: Record<string, string>;
	context?: SceneEvent[];
	events?: SceneEvent[];
	patches?: ScenePatch[];
	typing?: { from: number; to: number; who: string }[];
	nameColors?: { at: number; who: string; color: string }[];
	steps: SceneStep[];
};
