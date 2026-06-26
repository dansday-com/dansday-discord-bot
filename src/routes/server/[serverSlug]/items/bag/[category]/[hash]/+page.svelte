<script lang="ts">
	import { getContext } from 'svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import {
		effectSummary,
		effectLabel,
		effectIcon,
		effectMeta,
		actionVerb,
		describeItemOutcome,
		TARGETED_EFFECTS as TARGETED,
		ITEM_EFFECTS,
		type ItemOutcome
	} from '$lib/items.js';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;
	const { fmt, isBuffActive } = ctx;

	let pickingTargetFor = $state<any | null>(null);
	let targetSearch = $state('');

	let outcome = $state<ItemOutcome | null>(null);
	let outcomeTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (pickingTargetFor === null && outcome === null) return;
		document.body.style.overflow = 'hidden';
		return () => (document.body.style.overflow = '');
	});

	function showOutcome(effectType: string, result: any) {
		if (outcomeTimer) clearTimeout(outcomeTimer);
		outcome = describeItemOutcome(effectType, result);
		if (!outcome.spyReport) outcomeTimer = setTimeout(() => (outcome = null), 3500);
	}

	function dismissOutcome() {
		if (outcomeTimer) clearTimeout(outcomeTimer);
		outcome = null;
	}

	function untilLabel(ms: number | null): string {
		if (!ms) return '';
		return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
	}

	function relUntil(ms: number): string {
		const mins = Math.max(0, Math.round((ms - Date.now()) / 60000));
		if (mins <= 0) return 'now';
		if (mins < 60) return `${mins}m`;
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		return m ? `${h}h ${m}m` : `${h}h`;
	}

	function effectLine(e: any): string {
		if (e.effect_type === 'boost') return `${e.effect_value || 2}× Boost`;
		if (e.effect_type === 'leech') {
			if (e.leechRole === 'victim') return `Leeched by ${e.leechWith} (${e.effect_value || 0}%)`;
			return `Leeching ${e.leechWith} (${e.effect_value || 0}%)`;
		}
		if (e.effect_type === 'insurance') return `Insurance (${e.effect_value || 0}% refund)`;
		return effectLabel(e.effect_type);
	}

	const cooldownLabels: Record<string, string> = {
		steal: 'Steal cooldown',
		bomb: 'Bomb cooldown',
		insurance: 'Insurance cooldown',
		immunity: 'Immune to attacks'
	};

	async function use(item: any, targetHash?: string) {
		ctx.setBusy(item.member_item_id);
		try {
			const res = await fetch(`/api/items/${encodeURIComponent(ctx.serverSlug)}/use`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: ctx.hash, target_card: targetHash, member_item_id: item.member_item_id })
			});
			const d = await res.json();
			if (d.success) {
				await ctx.invalidateAll();
				showOutcome(item.effect_type, d.result ?? { outcome: d.outcome });
			} else showToast(d.error || 'Failed to use item', 'error');
		} finally {
			ctx.setBusy(null);
		}
	}

	function onUse(item: any) {
		if (!item.usable) {
			showToast(`${item.name} has been disabled and can't be used right now.`, 'error');
			return;
		}
		if (isBuffActive(item.effect_type)) {
			showToast(`${effectLabel(item.effect_type)} is already active`, 'error');
			return;
		}
		if (TARGETED.has(item.effect_type)) {
			targetSearch = '';
			pickingTargetFor = item;
		} else use(item);
	}

	async function pickTarget(item: any, targetHash: string) {
		await use(item, targetHash);
		pickingTargetFor = null;
	}

	let discardingId = $state<number | null>(null);

	async function discard(item: any) {
		discardingId = item.member_item_id;
		try {
			const res = await fetch(`/api/items/${encodeURIComponent(ctx.serverSlug)}/discard`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: ctx.hash, member_item_id: item.member_item_id, quantity: 1 })
			});
			const d = await res.json();
			if (d.success) await ctx.invalidateAll();
			else showToast(d.error || 'Failed to remove item', 'error');
		} catch {
			showToast('Failed to remove item', 'error');
		} finally {
			discardingId = null;
		}
	}

	const visibleTargets = $derived.by(() => {
		const q = targetSearch.trim().toLowerCase();
		const list = q ? (data.targets ?? []).filter((t: any) => (t.name ?? '').toLowerCase().includes(q)) : (data.targets ?? []);
		return [...list].sort((a: any, b: any) => (b.experience ?? 0) - (a.experience ?? 0));
	});

	function targetAvatar(t: any): string {
		return t.avatar ?? `https://cdn.discordapp.com/embed/avatars/${Number(t.discord_member_id) % 5 || 0}.png`;
	}

	const bagGroups = $derived.by(() => {
		const inv = (data.inventory ?? []) as any[];
		const out: { key: string; label: string; icon: string; items: any[] }[] = [];
		for (const eff of ITEM_EFFECTS) {
			const items = inv.filter((i) => i.effect_type === eff.id);
			if (items.length > 0) out.push({ key: eff.id, label: eff.label, icon: eff.icon, items });
		}
		return out;
	});
</script>

<svelte:head><title>{data.server.name || data.server.slug} Item Bag | {APP_NAME} Discord Bot</title></svelte:head>

{#snippet bagCard(item: any)}
	<article class="m-card" data-cat={item.effect_type}>
		<div class="m-card-glow"></div>
		<div class="m-card-top">
			<span class="m-card-medallion"><i class="fas {effectIcon(item.effect_type)}"></i><span class="m-card-qty">×{item.quantity}</span></span>
			<span class="m-card-tag">{effectLabel(item.effect_type)}</span>
		</div>
		<h3 class="m-card-name">{item.name}</h3>
		<p class="m-card-desc">{item.description || effectSummary(item)}</p>
		{#if effectMeta(item).length > 0}
			<div class="m-card-meta">
				{#each effectMeta(item) as chip}
					<span class="m-card-stat" title={chip.label}><i class="fas {chip.icon}"></i>{chip.label}</span>
				{/each}
			</div>
		{/if}
		<div class="m-card-foot">
			{#if !item.usable}
				<span class="m-card-owned">Owned ×{item.quantity}</span>
				<button
					class="m-card-discard"
					aria-label="Remove one from bag"
					title="Remove one"
					disabled={discardingId === item.member_item_id || ctx.busy === item.member_item_id}
					onclick={() => discard(item)}
				>
					{#if discardingId === item.member_item_id}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-trash-can"></i>{/if}
				</button>
				<button class="m-card-btn m-card-btn--use" disabled title="Disabled by admin"><i class="fas fa-ban"></i>Disabled</button>
			{:else if isBuffActive(item.effect_type)}
				<span class="m-card-active"><i class="fas fa-circle-check"></i>Active</span>
				<button class="m-card-btn m-card-btn--use" disabled><i class="fas fa-check"></i>In use</button>
			{:else}
				<span class="m-card-owned">Owned ×{item.quantity}</span>
				<button
					class="m-card-discard"
					aria-label="Remove one from bag"
					title="Remove one"
					disabled={discardingId === item.member_item_id || ctx.busy === item.member_item_id}
					onclick={() => discard(item)}
				>
					{#if discardingId === item.member_item_id}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-trash-can"></i>{/if}
				</button>
				<button class="m-card-btn m-card-btn--use" disabled={ctx.busy === item.member_item_id || item.quantity <= 0} onclick={() => onUse(item)}>
					{#if ctx.busy === item.member_item_id}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas {actionVerb(item.effect_type).icon}"></i>{/if}
					{actionVerb(item.effect_type).label}
				</button>
			{/if}
		</div>
	</article>
{/snippet}

{#if data.inventory.length === 0}
	<div class="m-members-empty">
		{#if (data.bagCategory ?? 'all') === 'all'}Your bag is empty. Buy items in the shop!{:else}No items in this category.{/if}
	</div>
{:else if (data.bagCategory ?? 'all') !== 'all'}
	<div class="m-cards">
		{#each data.inventory as item (item.member_item_id)}
			{@render bagCard(item)}
		{/each}
	</div>
{:else}
	{#each bagGroups as group (group.key)}
		<div class="m-group">
			<h2 class="m-group-head">
				<i class="fas {group.icon}"></i>{group.label}
				<span class="m-group-count">{group.items.length}</span>
			</h2>
			<div class="m-cards">
				{#each group.items as item (item.member_item_id)}
					{@render bagCard(item)}
				{/each}
			</div>
		</div>
	{/each}
{/if}

{#if pickingTargetFor}
	<div class="m-tgt-overlay" role="presentation" onclick={() => (pickingTargetFor = null)}>
		<div class="m-tgt-modal" role="dialog" aria-modal="true" aria-label="Pick a target" onclick={(e) => e.stopPropagation()}>
			<button class="m-items-back" onclick={() => (pickingTargetFor = null)}><i class="fas fa-arrow-left"></i>Back</button>
			<p class="m-items-pick-label">Pick a target for <strong>{pickingTargetFor.name}</strong>:</p>
			{#if (data.targets ?? []).length === 0}
				<div class="m-members-empty">No eligible targets in this server.</div>
			{:else}
				<div class="m-tgt-search">
					<i class="fas fa-search m-tgt-search-ic" aria-hidden="true"></i>
					<input
						type="search"
						class="m-tgt-search-inp"
						placeholder="Search a member to {actionVerb(pickingTargetFor.effect_type).label.toLowerCase()}…"
						bind:value={targetSearch}
					/>
				</div>
				{#if visibleTargets.length === 0}
					<div class="m-members-empty">No members match “{targetSearch}”.</div>
				{:else}
					<ul class="m-tgt-list">
						{#each visibleTargets as t (t.hash)}
							<li>
								<button class="m-tgt" disabled={ctx.busy === pickingTargetFor.member_item_id} onclick={() => pickTarget(pickingTargetFor, t.hash)}>
									<span class="m-tgt-rank">{t.rank != null ? `#${t.rank}` : '—'}</span>
									<img
										class="m-tgt-av"
										src={targetAvatar(t)}
										alt={t.name}
										loading="lazy"
										onerror={(e) => ((e.currentTarget as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png')}
									/>
									<span class="m-tgt-body">
										<span class="m-tgt-name">{t.name}</span>
										<span class="m-tgt-stats"><span>Lv.{t.level}</span><span class="m-tgt-dot">·</span><span>{fmt(t.experience)} XP</span></span>
										{#if t.roles.length > 0}
											<span class="m-tgt-roles">
												{#each t.roles.slice(0, 3) as role}
													<span class="m-tgt-role" style="--rc: {role.color || '#888'}">{role.name}</span>
												{/each}
											</span>
										{/if}
									</span>
									<i class="fas fa-crosshairs m-tgt-aim"></i>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</div>
	</div>
{/if}

{#if outcome}
	<div class="m-out-overlay" role="presentation" onclick={dismissOutcome}>
		<div
			class="m-out m-out--{outcome.tone}"
			class:m-out--spy={outcome.spyReport}
			role="dialog"
			aria-modal="true"
			aria-label={outcome.title}
			onclick={(e) => e.stopPropagation()}
		>
			<div class="m-out-icon"><i class="fas {outcome.icon}"></i></div>
			<div class="m-out-title">{outcome.title}</div>
			{#if outcome.deltaXp != null && outcome.deltaXp !== 0}
				<div class="m-out-delta {outcome.deltaXp >= 0 ? 'm-out-delta--up' : 'm-out-delta--down'}">
					{outcome.deltaXp >= 0 ? '+' : '−'}{fmt(Math.abs(outcome.deltaXp))} XP
				</div>
			{/if}
			<p class="m-out-line">{outcome.line}</p>
			{#if outcome.spyReport?.disguised}
				<div class="m-spy">
					<div class="m-spy-sec">
						<div class="m-spy-empty">🎭 They're wearing a Disguise — your spy couldn't read their bag, effects, or cooldowns.</div>
					</div>
				</div>
			{:else if outcome.spyReport}
				{@const rep = outcome.spyReport}
				<div class="m-spy">
					<div class="m-spy-sec">
						<div class="m-spy-head"><i class="fas fa-briefcase"></i>Bag</div>
						{#if rep.bag.length === 0}
							<div class="m-spy-empty">Their bag is empty.</div>
						{:else}
							<div class="m-spy-chips">
								{#each rep.bag as b}
									<span class="m-spy-chip"><i class="fas {effectIcon(b.effect_type)}"></i>{b.name} ×{b.quantity}</span>
								{/each}
							</div>
						{/if}
					</div>
					<div class="m-spy-sec">
						<div class="m-spy-head"><i class="fas fa-wand-magic-sparkles"></i>Active effects</div>
						{#if rep.effects.length === 0}
							<div class="m-spy-empty">No active effects.</div>
						{:else}
							<div class="m-spy-chips">
								{#each rep.effects as e}
									<span class="m-spy-chip"
										><i class="fas {effectIcon(e.effect_type)}"></i>{effectLine(e)}{#if e.expiresAt}<span class="m-spy-rel">· {relUntil(e.expiresAt)}</span
											>{/if}</span
									>
								{/each}
							</div>
						{/if}
					</div>
					<div class="m-spy-sec">
						<div class="m-spy-head"><i class="fas fa-stopwatch"></i>Cooldowns</div>
						{#if rep.cooldowns.length === 0}
							<div class="m-spy-empty">No active cooldowns.</div>
						{:else}
							<div class="m-spy-chips">
								{#each rep.cooldowns as c}
									<span class="m-spy-chip" class:m-spy-chip--shield={c.kind === 'immunity'}>
										<i class="fas {c.kind === 'immunity' ? 'fa-shield-halved' : 'fa-clock'}"></i>{cooldownLabels[c.kind] ?? c.kind}<span class="m-spy-rel"
											>· {relUntil(c.until)}</span
										>
									</span>
								{/each}
							</div>
						{/if}
					</div>
					<div class="m-spy-sec">
						<div class="m-spy-head"><i class="fas fa-crosshairs"></i>Bounty</div>
						{#if (rep.bounty ?? 0) > 0}
							<div class="m-spy-chips">
								<span class="m-spy-chip m-spy-chip--bounty"><i class="fas fa-crosshairs"></i>{fmt(rep.bounty)} XP on their head</span>
							</div>
						{:else}
							<div class="m-spy-empty">No bounty on them.</div>
						{/if}
					</div>
				</div>
			{/if}
			{#if outcome.untilMs}
				<div class="m-out-until"><i class="fas fa-clock"></i>Active until {untilLabel(outcome.untilMs)}</div>
			{/if}
			{#if outcome.spyReport}
				<button class="m-out-close" onclick={dismissOutcome}><i class="fas fa-check"></i>Done</button>
			{/if}
		</div>
	</div>
{/if}
