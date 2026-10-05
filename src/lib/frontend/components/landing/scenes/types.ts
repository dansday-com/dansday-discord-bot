import type { Component } from 'svelte';

export type Person = { name: string; avatar: string; app?: boolean };

export type SceneButton = { label: string; link?: boolean; tone?: 'grey' | 'blurple' | 'green' | 'red'; pressAt?: number };

export type SceneOption = { label: string; avatar?: string };

export type SceneSelect = { placeholder: string; options: SceneOption[]; selected?: number; openAt?: number; pickAt?: number; pick?: number };

export type SceneRow = SceneButton[] | SceneSelect;

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
	rows?: SceneRow[];
	used?: { who: string; command: string };
	pop?: ScenePop;
	ephemeral?: boolean;
	replyTo?: string;
	newGroup?: boolean;
};

export type ScenePatch = { at: number; id: string; text?: string; embed?: SceneEmbed | null; rows?: SceneRow[] };

export type SceneField = { label: string; value: string; placeholder?: string; typeFrom?: number; select?: boolean; tall?: boolean };

export type SceneModal = { at: number; submitAt: number; title: string; fields: SceneField[] };

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
	commands?: { name: string; desc: string }[];
	modals?: SceneModal[];
	typing?: { from: number; to: number; who: string }[];
	nameColors?: { at: number; who: string; color: string }[];
	steps: SceneStep[];
};
