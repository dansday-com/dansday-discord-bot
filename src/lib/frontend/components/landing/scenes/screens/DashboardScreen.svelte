<script lang="ts">
	import { flip } from 'svelte/animate';
	import { quintOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import { xpForLevel } from '$lib/level-rewards.js';
	import { avatar } from '../scripts/common.js';
	import type { SceneScreenProps } from '../types.js';

	let { t, still }: SceneScreenProps = $props();

	const REGULAR = '#1abc9c';
	const VETERAN = '#e67e22';
	const fmt = (n: number) => n.toLocaleString('en-US');

	const ADD_PRESS = 800;
	const ROW_AT = 1000;
	const TYPE = [
		{ at: 1400, value: '1' },
		{ at: 1650, value: '10' }
	];
	const MENU = { from: 1950, to: 2600 };
	const SAVE_PRESS = 3200;
	const SAVED = 3700;
	const SYNCED = 4300;

	const MEMBERS = [
		{ id: 'kai', name: 'Kai', avatar: avatar(0), level: 21 },
		{ id: 'rin', name: 'Rin', avatar: avatar(3), level: 20 },
		{ id: 'jun', name: 'Jun', avatar: avatar(4), level: 17 },
		{ id: 'mira', name: 'Mira', avatar: avatar(2), level: 9 },
		{ id: 'nova', name: 'Nova', avatar: avatar(1), level: 7 },
		{ id: 'ash', name: 'Ash', avatar: avatar(5), level: 6 }
	];

	const levelTyped = $derived(TYPE.reduce((value, s) => (t >= s.at ? s.value : value), ''));
	const roleTyped = $derived(t >= MENU.to);
	const saving = $derived(t >= SAVE_PRESS && t < SAVED);
	const synced = $derived(t >= SYNCED);
	const pressed = (at: number) => t >= at && t < at + 220;
	const animMs = $derived(still ? 0 : 420);

	const list = $derived.by(() => {
		const vets = synced ? MEMBERS.filter((m) => m.level >= 10) : [];
		const regs = MEMBERS.filter((m) => !vets.includes(m));
		return [
			...(vets.length ? [{ id: 'h-vet', header: `Veteran — ${vets.length}`, color: VETERAN }] : []),
			...vets.map((m) => ({ ...m, color: VETERAN })),
			{ id: 'h-reg', header: `Regular — ${regs.length}`, color: REGULAR },
			...regs.map((m) => ({ ...m, color: REGULAR }))
		];
	});
</script>

<div class="flex h-full">
	<div class="bg-ash-900 @container relative min-w-0 flex-1 overflow-hidden p-4">
		<div class="mb-3 flex items-center gap-2.5">
			<span class="bg-primary text-primary-content grid size-8 place-items-center rounded-full text-[13px] font-bold">N</span>
			<span class="text-ash-100 text-[14px] font-semibold">Night Owls</span>
		</div>

		<div class="bg-ash-800 border-ash-700 mb-3 flex gap-1 overflow-hidden rounded-lg border p-1">
			{#each [['Configuration', 'fa-sliders'], ['Members', 'fa-users'], ['Rewards', 'fa-trophy'], ['Moderation', 'fa-gavel']] as [tab, icon] (tab)}
				<span
					class="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-medium {tab === 'Rewards'
						? 'bg-ash-600 text-ash-100'
						: 'text-ash-400'}"
				>
					<i class="fas {icon} text-[10px] {tab === 'Rewards' ? 'text-yellow-400' : ''}"></i>{tab}
				</span>
			{/each}
		</div>

		<div class="bg-ash-800 border-ash-700 rounded-xl border p-3">
			<p class="text-ash-100 flex items-center gap-2 text-[13px] font-semibold"><i class="fas fa-trophy text-yellow-400"></i>Level rewards</p>
			<p class="text-ash-400 mt-0.5 mb-2.5 text-[10.5px]">Members get the role when they reach the level.</p>

			<div class="flex flex-col gap-1.5">
				<div class="bg-ash-700 border-ash-600 flex items-center gap-2 rounded-lg border p-1.5 text-[11px]">
					<span class="text-ash-300">Level</span>
					<span class="bg-ash-800 border-ash-600 text-ash-100 w-10 rounded-md border px-1.5 py-1">5</span>
					<span class="size-2 shrink-0 rounded-full" style="background: {REGULAR}"></span>
					<span class="bg-ash-800 border-ash-600 text-ash-100 min-w-0 flex-1 truncate rounded-md border px-2 py-1">Regular</span>
					<span class="text-ash-400 hidden whitespace-nowrap tabular-nums @[420px]:inline">{fmt(xpForLevel(5, 100, 1.2))} XP</span>
				</div>

				{#if t >= ROW_AT}
					<div
						in:fly={{ y: 6, duration: animMs, easing: quintOut }}
						class="bg-ash-700 border-ash-600 relative flex items-center gap-2 rounded-lg border p-1.5 text-[11px]"
					>
						<span class="text-ash-300">Level</span>
						<span class="bg-ash-800 text-ash-100 w-10 rounded-md border px-1.5 py-1 {levelTyped && !roleTyped ? 'border-emerald-500/60' : 'border-ash-600'}"
							>{levelTyped || ' '}</span
						>
						<span class="size-2 shrink-0 rounded-full" style="background: {roleTyped ? VETERAN : 'var(--color-ash-400)'}"></span>
						<span
							class="bg-ash-800 min-w-0 flex-1 truncate rounded-md border px-2 py-1 {roleTyped ? 'text-ash-100' : 'text-ash-400'} {t >= MENU.from && t < MENU.to
								? 'border-emerald-500/60'
								: 'border-ash-600'}">{roleTyped ? 'Veteran' : 'Pick a role'}</span
						>
						{#if levelTyped === '10'}
							<span class="text-ash-400 hidden whitespace-nowrap tabular-nums @[420px]:inline">{fmt(xpForLevel(10, 100, 1.2))} XP</span>
						{/if}
						{#if t >= MENU.from && t < MENU.to}
							<span
								in:fly={{ y: -4, duration: still ? 0 : 160, easing: quintOut }}
								class="bg-ash-800 border-ash-600 absolute top-full right-1.5 left-[42%] z-10 mt-1 rounded-md border p-1 shadow-xl"
							>
								{#each [['Veteran', VETERAN], ['Regular', REGULAR], ['Booster', '#f47fff']] as [name, color] (name)}
									<span
										class="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] {name === 'Veteran' && t >= MENU.to - 250
											? 'bg-ash-600 text-ash-100'
											: 'text-ash-300'}"><span class="size-2 rounded-full" style="background: {color}"></span>{name}</span
									>
								{/each}
							</span>
						{/if}
					</div>
				{/if}

				<span class="dash-press text-ash-200 border-ash-600 w-fit rounded-lg border px-2.5 py-1 text-[10.5px]" class:dash-pressed={pressed(ADD_PRESS)}>
					<i class="fas fa-plus mr-1 text-emerald-400"></i>Add reward
				</span>
			</div>

			<div class="border-ash-700 mt-2.5 flex flex-col gap-1.5 border-t pt-2.5">
				{#each ['Keep roles when a level drops', 'Keep lower rewards'] as toggle (toggle)}
					<span class="text-ash-300 flex items-center justify-between gap-3 text-[10.5px]">
						{toggle}<span class="bg-ash-400 relative h-4 w-7 shrink-0 rounded-full"
							><span class="absolute top-0.5 left-3.5 size-3 rounded-full bg-white"></span></span
						>
					</span>
				{/each}
			</div>
		</div>

		<span
			class="dash-press mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-[11.5px] font-medium text-white"
			class:dash-pressed={pressed(SAVE_PRESS)}
		>
			<i class="fas {saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}"></i>Save rewards
		</span>

		{#if t >= SAVED}
			<div
				in:fly={{ y: -8, duration: animMs, easing: quintOut }}
				class="absolute right-3 bottom-3 flex max-w-[78%] items-start gap-2 rounded-lg border border-emerald-500/40 bg-[#14271f] px-3 py-2 text-[11px] text-emerald-100 shadow-xl"
			>
				<i class="fas fa-circle-check mt-0.5 text-emerald-400"></i>Rewards saved. Giving roles to members who already qualify.
			</div>
		{/if}
	</div>

	<div class="bg-ash-800 border-ash-950 w-[150px] shrink-0 overflow-hidden border-l px-2 py-3 sm:w-[184px]">
		{#each list as row (row.id)}
			<div animate:flip={{ duration: animMs, easing: quintOut }}>
				{#if 'header' in row}
					<p class="text-ash-300 mt-2 mb-1 px-1.5 text-[10.5px] font-semibold tracking-[0.04em] uppercase first:mt-0">{row.header}</p>
				{:else}
					<span class="flex items-center gap-2 rounded px-1.5 py-1">
						<img src={row.avatar} alt="" class="size-7 shrink-0 rounded-full" loading="lazy" />
						<span class="dash-name truncate text-[12.5px] font-medium" style="color: {row.color}">{row.name}</span>
					</span>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.dash-press {
		transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.dash-pressed {
		transform: scale(0.95);
	}

	.dash-name {
		transition: color 400ms ease;
	}

	@media (prefers-reduced-motion: reduce) {
		.dash-press,
		.dash-name {
			transition: none;
		}
	}
</style>
