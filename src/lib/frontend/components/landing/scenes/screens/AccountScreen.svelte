<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { xpForLevel } from '$lib/level-rewards.js';
	import { avatar } from '../scripts/common.js';
	import type { SceneScreenProps } from '../types.js';

	let { t }: SceneScreenProps = $props();

	const BASE_XP = 100;
	const MULTIPLIER = 1.2;
	const levelAt = (xp: number) => {
		let lv = 1;
		while (xp >= xpForLevel(lv + 1, BASE_XP, MULTIPLIER)) lv++;
		return lv;
	};
	const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

	const START_XP = 3600;
	const TARGETS = [
		{ rank: 1, name: 'Kai', avatar: avatar(0), xp: 18240 },
		{ rank: 2, name: 'Rin', avatar: avatar(3), xp: 15880 },
		{ rank: 5, name: 'Jun', avatar: avatar(4), xp: 10410 }
	];
	const VICTIM = TARGETS[2];
	const STOLEN = Math.floor((VICTIM.xp * 8) / 100);

	const PRESS = 2300;
	const SHEET = { from: 2600, to: 4800 };
	const PICK = 4300;
	const OUTCOME = { from: 5000, to: 7800 };
	const COUNT = { from: 8000, to: 8900 };
	const PUSH = 9800;

	const xp = $derived.by(() => {
		if (t < COUNT.from) return START_XP;
		if (t >= COUNT.to) return START_XP + STOLEN;
		const p = (t - COUNT.from) / (COUNT.to - COUNT.from);
		return START_XP + STOLEN * (1 - Math.pow(1 - p, 3));
	});
	const level = $derived(levelAt(xp));
	const floor = $derived(xpForLevel(level, BASE_XP, MULTIPLIER));
	const next = $derived(xpForLevel(level + 1, BASE_XP, MULTIPLIER));
	const pct = $derived(Math.round(((xp - floor) / (next - floor)) * 100));
	const sheetOpen = $derived(t >= SHEET.from && t < SHEET.to);
	const outcomeOpen = $derived(t >= OUTCOME.from && t < OUTCOME.to);
	const tapped = (at: number) => t >= at && t < at + 520;
</script>

<div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
	<div class="flex h-10 shrink-0 items-center px-3">
		<span class="bg-base-300/70 text-base-content/70 flex h-8 w-full items-center justify-center gap-1.5 rounded-xl text-[12px]">
			<i class="fas fa-lock text-[9px]"></i>dansday.dev
		</span>
	</div>

	<div class="from-primary relative isolate mx-3 mt-1 flex shrink-0 items-center gap-3 overflow-hidden rounded-2xl bg-linear-to-br to-[#7a1e06] px-3.5 py-3">
		<img src={avatar(2)} alt="" class="size-10 shrink-0 rounded-full ring-2 ring-white/60" loading="lazy" />
		<div class="min-w-0 flex-1">
			<p class="flex items-center gap-1 text-[9px] font-bold tracking-[0.08em] text-white/60 uppercase"><i class="fas fa-wallet"></i>Wallet</p>
			<p class="truncate text-[13px] font-extrabold text-white">Mira</p>
			<p class="text-[19px] leading-tight font-extrabold text-white tabular-nums">
				{fmt(xp)}<span class="ml-1 text-[11px] font-bold text-white/70">XP</span>
			</p>
			<div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/20">
				<div class="h-full rounded-full bg-linear-to-r from-[#5eead4] to-[#fbbf24]" style="width: {pct}%"></div>
			</div>
			<p class="mt-1 flex justify-between gap-2 text-[9.5px] font-semibold text-white/65">
				<span>Lvl {level}</span><span>{fmt(next - xp)} XP to Lvl {level + 1}</span>
			</p>
		</div>
		<div class="flex shrink-0 flex-col items-center gap-2 border-l border-white/15 pl-3 leading-tight">
			<span class="text-center"
				><b class="block text-[15px] font-extrabold text-white tabular-nums">{pct}%</b><span class="text-[8.5px] font-bold text-white/60 uppercase"
					>Level {level}</span
				></span
			>
			<span class="text-center"
				><b class="block text-[15px] font-extrabold text-white tabular-nums">#9</b><span class="text-[8.5px] font-bold text-white/60 uppercase">Rank</span
				></span
			>
		</div>
	</div>

	<div class="border-base-300 bg-base-200 mx-3 mt-2.5 flex shrink-0 gap-1 overflow-hidden rounded-xl border p-1">
		{#each ['Task', 'Rewards', 'Items', 'Minigames'] as tab (tab)}
			<span
				class="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold {tab === 'Items'
					? 'bg-base-100 text-base-content shadow-sm'
					: 'text-base-content/55'}"
			>
				{tab}{#if tab === 'Items'}<span class="bg-primary/12 text-primary rounded-full px-1.5 text-[9.5px]">{t < PICK ? 1 : 0}/50</span>{/if}
			</span>
		{/each}
	</div>

	{#snippet itemCard(cat: string, icon: string, name: string, desc: string, price: number, owned: boolean)}
		<article
			class="relative flex flex-col gap-1.5 overflow-hidden rounded-[14px] border p-2.5"
			style="--cat: {cat}; background: radial-gradient(120% 80% at 50% -10%, color-mix(in srgb, var(--cat) 22%, transparent), transparent 60%), linear-gradient(170deg, color-mix(in srgb, var(--cat) 10%, var(--color-base-100)), var(--color-base-100) 70%); border-color: color-mix(in srgb, var(--cat) 26%, var(--color-base-300));"
		>
			<span
				class="relative grid size-9 place-items-center rounded-xl border text-[16px] text-(--cat)"
				style="background: linear-gradient(150deg, color-mix(in srgb, var(--cat) 38%, transparent), color-mix(in srgb, var(--cat) 14%, transparent)); border-color: color-mix(in srgb, var(--cat) 42%, transparent);"
			>
				<i class="fas {icon}"></i>
				{#if owned}
					<span
						class="border-base-100 absolute -right-1.5 -bottom-1.5 grid h-4 min-w-4 place-items-center rounded-full border-2 bg-(--cat) px-1 text-[9px] font-extrabold text-white"
						>×1</span
					>
				{/if}
			</span>
			<p class="text-base-content text-[12.5px] leading-tight font-extrabold">{name}</p>
			<p class="text-base-content/60 text-[10.5px] leading-snug">{desc}</p>
			<p class="text-[12px] font-extrabold text-[#d9a528]">{fmt(price)}<span class="ml-0.5 text-[9px] opacity-70">XP</span></p>
			{#if owned}
				<span
					class="account-press relative flex h-7 items-center justify-center gap-1 overflow-hidden rounded-lg text-[11px] font-bold text-white"
					class:account-pressed={tapped(PRESS)}
					style="background: linear-gradient(135deg, var(--cat), color-mix(in srgb, var(--cat) 68%, black 22%));"
				>
					<i class="fas {icon}"></i>Steal
					{#if tapped(PRESS)}<span class="account-ripple"></span>{/if}
				</span>
			{:else}
				<span
					class="flex h-7 items-center justify-center gap-1 rounded-lg bg-linear-to-br from-[rgba(214,83,109,0.94)] to-[color-mix(in_srgb,var(--color-primary)_96%,transparent)] text-[11px] font-bold text-white"
				>
					<i class="fas fa-cart-plus"></i>Buy
				</span>
			{/if}
		</article>
	{/snippet}

	<div class="mx-3 mt-2.5 grid shrink-0 grid-cols-2 gap-2">
		{@render itemCard('#c0392b', 'fa-hand', 'Pickpocket', "Take 1–25% of a member's XP.", 400, t < PICK)}
		{@render itemCard('#1d6f8a', 'fa-shield', 'Shield', 'Block the next steal, bomb or leech.', 600, false)}
		{@render itemCard('#d35400', 'fa-bomb', 'Bomb', "Burn 1–50% of a member's XP.", 600, false)}
		{@render itemCard('#4b6584', 'fa-magnifying-glass', 'Spy', "Scout a member's bag before you strike.", 300, false)}
	</div>

	<div class="account-overlay absolute inset-0 bg-black/40" class:account-overlay-on={sheetOpen || outcomeOpen}></div>

	<div class="account-sheet bg-base-100 absolute inset-x-0 bottom-0 rounded-t-2xl px-3.5 pt-3 pb-4 shadow-2xl" class:account-sheet-on={sheetOpen}>
		<span class="bg-base-300 mx-auto mb-3 block h-1 w-10 rounded-full"></span>
		<p class="text-base-content/70 text-[12.5px]">Pick a target for <strong class="text-base-content">Pickpocket</strong>:</p>
		<span class="border-base-300 text-base-content/45 mt-2 flex h-8 items-center gap-2 rounded-lg border px-2.5 text-[11.5px]">
			<i class="fas fa-magnifying-glass text-[10px]"></i>Search a member to steal…
		</span>
		<ul class="mt-2 flex flex-col gap-1.5">
			{#each TARGETS as target (target.name)}
				{@const picked = target === VICTIM && t >= PICK}
				<li
					class="relative flex items-center gap-2.5 overflow-hidden rounded-xl border px-2.5 py-2 {picked
						? 'border-primary/45 bg-primary/8'
						: 'border-base-300 bg-base-100'}"
				>
					<span class="text-base-content/60 w-6 shrink-0 text-center text-[11px] font-bold">#{target.rank}</span>
					<img src={target.avatar} alt="" class="size-8 shrink-0 rounded-full" loading="lazy" />
					<span class="min-w-0 flex-1">
						<span class="text-base-content block truncate text-[12.5px] font-semibold">{target.name}</span>
						<span class="text-base-content/60 block text-[10.5px]">Lv.{levelAt(target.xp)} · {fmt(target.xp)} XP</span>
					</span>
					<i class="fas fa-crosshairs shrink-0 text-[12px] text-[#c0392b] opacity-70"></i>
					{#if target === VICTIM && tapped(PICK)}<span class="account-ripple"></span>{/if}
				</li>
			{/each}
		</ul>
	</div>

	<div
		class="account-modal border-base-300 border-t-success bg-base-100 absolute top-1/2 left-1/2 w-[82%] rounded-2xl border border-t-4 px-4 pt-5 pb-4 text-center shadow-2xl"
		class:account-modal-on={outcomeOpen}
	>
		<span class="bg-primary/14 border-primary/35 text-primary mx-auto mb-2.5 grid size-14 place-items-center rounded-full border text-[24px]">
			<i class="fas fa-hand"></i>
		</span>
		<p class="text-base-content text-[19px] font-extrabold tracking-tight">Robbed!</p>
		<p class="text-success mt-1 text-[22px] font-extrabold tabular-nums">+{fmt(STOLEN)} XP</p>
		<p class="text-base-content/60 mt-1.5 text-[12px]">+{fmt(STOLEN)} XP taken</p>
	</div>

	<div
		class="account-push border-base-300 bg-base-100/95 absolute inset-x-2.5 top-1 flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 shadow-xl"
		class:account-push-on={t >= PUSH}
	>
		<span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#5865f2] text-[17px] text-white"><i class="fa-brands fa-discord"></i></span>
		<span class="min-w-0 flex-1">
			<span class="text-base-content flex items-center justify-between gap-2 text-[11.5px] font-bold">
				<span class="truncate">#items · Night Owls</span><span class="text-base-content/45 shrink-0 text-[10px] font-semibold">now</span>
			</span>
			<span class="text-base-content/75 block truncate text-[11.5px]">{APP_NAME}: @Mira @Jun · 💰 Member Robbed!</span>
		</span>
	</div>
</div>

<style>
	.account-press {
		transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.account-pressed {
		transform: scale(0.95);
	}

	.account-ripple {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 48px;
		height: 48px;
		margin: -24px 0 0 -24px;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.45);
		pointer-events: none;
		animation: account-ripple 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes account-ripple {
		from {
			opacity: 0.6;
			transform: scale(0.4);
		}
		to {
			opacity: 0;
			transform: scale(2.2);
		}
	}

	.account-overlay {
		opacity: 0;
		transition: opacity 240ms ease;
	}

	.account-overlay-on {
		opacity: 1;
	}

	.account-sheet {
		transform: translateY(105%);
		transition: transform 380ms cubic-bezier(0.32, 0.72, 0, 1);
	}

	.account-sheet-on {
		transform: translateY(0);
	}

	.account-modal {
		opacity: 0;
		transform: translate(-50%, -50%) scale(0.95);
		transition:
			opacity 220ms cubic-bezier(0.22, 1, 0.36, 1),
			transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.account-modal-on {
		opacity: 1;
		transform: translate(-50%, -50%) scale(1);
	}

	.account-push {
		opacity: 0;
		transform: translateY(-120%);
		transition:
			opacity 300ms ease,
			transform 420ms cubic-bezier(0.32, 0.72, 0, 1);
	}

	.account-push-on {
		opacity: 1;
		transform: translateY(0);
	}

	@media (prefers-reduced-motion: reduce) {
		.account-press,
		.account-overlay,
		.account-sheet,
		.account-modal,
		.account-push {
			transition: none;
		}

		.account-ripple {
			animation: none;
			opacity: 0;
		}
	}
</style>
