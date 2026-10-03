<script lang="ts">
	import { BRAND_PRIMARY } from '$lib/brand.js';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import DiscordIcon from '$lib/frontend/components/shell/DiscordIcon.svelte';
	import DiscordEmbed from '../DiscordEmbed.svelte';
	import DiscordMessage from '../DiscordMessage.svelte';
	import { BOT } from '../scripts/common.js';
	import type { SceneScreenProps } from '../types.js';

	let { t }: SceneScreenProps = $props();

	const STAFF = { pick: 0, toggle: 1000, save: 2000, saved: 2500 };
	const AFK = { pick: 5000, toggle: 6200, save: 7200, saved: 7700 };
	const DISCORD = { open: 9800, press: 11000, reply: 11400 };

	const MODULES = [
		{ id: 'main', label: 'Main', icon: 'fa-gear', tone: 'text-emerald-400', on: () => true },
		{ id: 'ai', label: 'AI', icon: 'fa-robot', tone: 'text-violet-400', on: () => true },
		{ id: 'welcomer', label: 'Welcomer', icon: 'fa-hand', tone: 'text-sky-400', on: () => true },
		{ id: 'booster', label: 'Booster', icon: 'fa-gem', tone: 'text-purple-400', on: () => true },
		{ id: 'notifications', label: 'Channel notification', icon: 'fa-bell', tone: 'text-rose-400', on: () => true },
		{ id: 'forwarder', label: 'Forwarder', icon: 'fa-forward', tone: 'text-violet-400', on: () => false },
		{ id: 'leveling', label: 'Leveling', icon: 'fa-chart-line', tone: 'text-lime-400', on: () => true },
		{ id: 'supporter', label: 'Custom Supporter Role', icon: 'fa-star', tone: 'text-yellow-400', on: () => true },
		{ id: 'giveaway', label: 'Giveaway', icon: 'fa-gift', tone: 'text-pink-400', on: () => true },
		{ id: 'afk', label: 'AFK', icon: 'fa-moon', tone: 'text-indigo-400', on: (now: number) => now < AFK.saved },
		{ id: 'feedback', label: 'Feedback', icon: 'fa-comment-dots', tone: 'text-cyan-400', on: () => false },
		{ id: 'staff', label: 'Staff Rating', icon: 'fa-clipboard-check', tone: 'text-orange-400', on: (now: number) => now >= STAFF.saved },
		{ id: 'creator', label: 'Content Creator', icon: 'fa-video', tone: 'text-pink-400', on: () => false },
		{ id: 'alerts', label: 'Creator Alerts', icon: 'fa-tower-broadcast', tone: 'text-rose-400', on: () => true },
		{ id: 'quest', label: 'Discord Quest', icon: 'fa-gem', tone: 'text-sky-400', on: () => true },
		{ id: 'roblox', label: 'Roblox Catalog', icon: 'fa-cube', tone: 'text-emerald-400', on: () => true },
		{ id: 'public', label: 'Public', icon: 'fa-chart-pie', tone: 'text-amber-400', on: () => true }
	];

	const PAGES = {
		staff: {
			title: 'Staff Rating',
			icon: 'fa-clipboard-check',
			tone: 'text-orange-400',
			about: 'Review queue, rating announcements, and cooldown.',
			module: 'Staff rating module',
			moduleAbout: 'When off, staff rating flows and related Discord UI are disabled.',
			fields: [
				{ label: 'Rating Cooldown (Days)', value: '7' },
				{ label: 'Review channel', value: '# staff-review' },
				{ label: 'Rating Update Channel', value: '# staff-ratings' }
			]
		},
		afk: {
			title: 'AFK',
			icon: 'fa-moon',
			tone: 'text-indigo-400',
			about: 'Menu button, nicknames, mention notices, and voice auto-clear.',
			module: 'AFK module',
			moduleAbout: 'When off, the AFK button still shows but says the feature is turned off, and all AFK behavior stops.',
			fields: []
		}
	};

	const onAfk = $derived(t >= AFK.pick);
	const page = $derived(onAfk ? PAGES.afk : PAGES.staff);
	const step = $derived(onAfk ? AFK : STAFF);
	const switchOn = $derived(onAfk ? t < AFK.toggle : t >= STAFF.toggle);
	const saving = $derived(t >= step.save && t < step.saved);
	const toast = $derived((t >= STAFF.saved && t < STAFF.saved + 2000) || (t >= AFK.saved && t < AFK.saved + 2000));
	const activeModule = $derived(onAfk ? 'afk' : 'staff');
	const discordOpen = $derived(t >= DISCORD.open);
	const pressed = (at: number) => t >= at && t < at + 200;

	const menuEmbed = $derived({
		color: BRAND_PRIMARY,
		title: '👤 Me',
		description: 'Your own status and alerts.',
		buttons: [
			{ label: '⏸️ Set AFK Status', tone: 'green' as const, pressAt: DISCORD.press },
			{ label: '🔔 Notifications', tone: 'green' as const },
			{ label: '⬅️ Back' }
		]
	});
</script>

<div class="bg-ash-900 @container relative h-full overflow-hidden p-3 @[560px]:p-4">
	<div class="mb-2 flex items-center gap-2">
		<span class="bg-ash-600 grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-violet-300">N</span>
		<span class="text-ash-100 truncate text-[13px] font-semibold">Night Owls</span>
		<span class="bg-ash-800 border-ash-700 text-ash-300 ml-auto flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10.5px]">
			<i class="fas fa-sliders text-[9px] text-emerald-400"></i>Configuration
		</span>
	</div>

	<div class="flex h-[calc(100%-2.5rem)] gap-2.5">
		<nav class="bg-ash-800 border-ash-700 flex shrink-0 flex-col gap-px overflow-hidden rounded-xl border p-1 @[560px]:w-44">
			{#each MODULES as mod (mod.id)}
				{@const active = mod.id === activeModule}
				<span
					class="dash-row flex h-[21px] shrink-0 items-center gap-2 rounded-md px-1.5 text-[10.5px] @[560px]:px-2 {active
						? 'bg-ash-600 text-ash-100 font-medium'
						: 'text-ash-400'}"
				>
					<i class="dash-icon fas {mod.icon} w-3.5 shrink-0 text-center text-[10px] {mod.on(t) ? mod.tone : 'text-ash-500'}"></i>
					<span class="hidden truncate @[560px]:inline">{mod.label}</span>
				</span>
			{/each}
		</nav>

		<div class="bg-ash-800 border-ash-700 relative min-w-0 flex-1 overflow-hidden rounded-xl border p-3">
			{#key page.title}
				<div class="dash-page space-y-2.5">
					<p class="text-ash-100 flex items-center gap-2 text-[13px] font-semibold"><i class="fas {page.icon} {page.tone}"></i>{page.title}</p>
					<p class="text-ash-400 -mt-1.5 text-[10.5px] leading-snug">{page.about}</p>

					<div class="flex items-start justify-between gap-3">
						<div class="flex min-w-0 items-start gap-2">
							<i class="fas {page.icon} {page.tone} mt-0.5 shrink-0 text-[11px]"></i>
							<div class="min-w-0">
								<p class="text-ash-300 text-[11px] font-medium">{page.module}</p>
								<p class="text-ash-500 text-[10px] leading-snug">{page.moduleAbout}</p>
							</div>
						</div>
						<span
							class="dash-switch relative mt-0.5 h-5 w-9 shrink-0 rounded-full {switchOn ? 'bg-ash-400' : 'bg-ash-700'}"
							class:dash-pressed={pressed(step.toggle)}
						>
							<span class="dash-knob absolute top-1 left-1 size-3 rounded-full bg-white shadow" class:dash-knob-on={switchOn}></span>
						</span>
					</div>

					{#if !switchOn}
						<p class="flex items-start gap-1.5 text-[10px] leading-snug text-amber-200/90">
							<i class="fas fa-power-off mt-0.5 shrink-0 text-amber-400/90"></i>Module is off. Save configuration to apply. Turn the module on to edit the
							options below.
						</p>
					{/if}

					{#if page.fields.length}
						<div class="dash-options space-y-1.5" class:dash-options-off={!switchOn}>
							{#each page.fields as field (field.label)}
								<div>
									<p class="text-ash-300 mb-0.5 text-[10.5px] font-medium">{field.label}</p>
									<p class="bg-ash-700 border-ash-600 text-ash-200 rounded-lg border px-2 py-1.5 text-[10.5px]">{field.value}</p>
								</div>
							{/each}
						</div>
					{/if}

					<span
						class="dash-press bg-ash-500 text-ash-100 flex h-8 items-center justify-center gap-1.5 rounded-lg text-[11.5px] font-medium"
						class:dash-pressed={pressed(step.save)}
					>
						{#if saving}<i class="fas fa-spinner fa-spin"></i>{/if}{saving ? 'Saving...' : 'Save Configuration'}
					</span>
				</div>
			{/key}
		</div>
	</div>

	<div class="dash-toast border-ash-600 bg-ash-700/95 absolute top-3 right-3 w-40 overflow-hidden rounded-xl border shadow-xl" class:dash-toast-on={toast}>
		<div class="flex items-center gap-2 p-2.5">
			<span class="grid size-7 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-[13px] text-emerald-400"><i class="fas fa-circle-check"></i></span>
			<span class="text-ash-100 text-[12px] font-semibold">Saved</span>
		</div>
	</div>

	<div
		class="dash-discord bg-ash-900 border-ash-950 absolute inset-x-2 bottom-2 flex max-h-[calc(100%-1rem)] flex-col overflow-hidden rounded-xl border shadow-[0_24px_60px_-20px_rgba(0,0,0,0.75)] @[560px]:inset-x-auto @[560px]:right-3 @[560px]:bottom-3 @[560px]:w-[330px]"
		class:dash-discord-on={discordOpen}
	>
		<div class="border-ash-950 flex h-9 items-center gap-2 border-b px-3">
			<DiscordIcon class="text-[13px] text-[#5865f2]" />
			<i class="fas fa-hashtag text-ash-300 text-[11px]"></i><span class="text-ash-50 text-[12.5px] font-semibold">general</span>
		</div>
		<div class="@container flex min-h-0 flex-col justify-end overflow-hidden pb-3">
			<DiscordMessage name={APP_NAME} avatar={BOT.avatar} app ephemeral time="Today at 21:20">
				<DiscordEmbed embed={menuEmbed} {t} />
			</DiscordMessage>
			{#if t >= DISCORD.reply}
				<DiscordMessage name={APP_NAME} avatar={BOT.avatar} app ephemeral time="Today at 21:20">
					❌ This feature is turned off for this server. An administrator can enable it in the bot configuration panel.
				</DiscordMessage>
			{/if}
		</div>
	</div>
</div>

<style>
	.dash-icon,
	.dash-row {
		transition:
			background-color 250ms ease,
			color 300ms ease;
	}

	.dash-page {
		animation: dash-page 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes dash-page {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}

	.dash-switch {
		transition:
			background-color 200ms ease,
			transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.dash-knob {
		transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.dash-knob-on {
		transform: translateX(16px);
	}

	.dash-options {
		transition: opacity 250ms ease;
	}

	.dash-options-off {
		opacity: 0.5;
	}

	.dash-press {
		transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.dash-pressed {
		transform: scale(0.96);
	}

	.dash-toast {
		opacity: 0;
		transform: translateY(-8px) scale(0.96);
		transition:
			opacity 240ms cubic-bezier(0.22, 1, 0.36, 1),
			transform 300ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.dash-toast-on {
		opacity: 1;
		transform: translateY(0) scale(1);
	}

	.dash-discord {
		opacity: 0;
		transform: translateY(24px);
		pointer-events: none;
		transition:
			opacity 300ms ease,
			transform 420ms cubic-bezier(0.32, 0.72, 0, 1);
	}

	.dash-discord-on {
		opacity: 1;
		transform: translateY(0);
	}

	@media (prefers-reduced-motion: reduce) {
		.dash-icon,
		.dash-row,
		.dash-switch,
		.dash-knob,
		.dash-options,
		.dash-press,
		.dash-toast,
		.dash-discord {
			transition: none;
		}

		.dash-page {
			animation: none;
		}
	}
</style>
