<script lang="ts">
	import { CHANNEL_PICKER_ACCENT } from '$lib/frontend/controlAccents.js';

	interface Channel {
		discord_channel_id: string;
		name: string;
		type: string | number;
		category_id: number | null;
		position: number | null;
	}

	interface Category {
		id: number;
		discord_category_id: string;
		name: string;
		position: number | null;
	}

	interface Props {
		channels: Channel[];
		categories?: Category[];
		value: string | string[];
		placeholder?: string;
		multi?: boolean;
		onchange: (value: string | string[]) => void;
	}

	let { channels, categories = [], value, placeholder = 'Select channel...', multi = false, onchange }: Props = $props();

	let open = $state(false);
	let search = $state('');
	let pending = $state<string[]>([]);

	const currentIds = $derived(multi ? (value as string[]) : value ? [value as string] : []);
	const selected = $derived(!multi ? channels.find((c) => c.discord_channel_id === (value as string)) : null);

	function channelType(type: string | number): string {
		if (type === 'GUILD_TEXT' || type === '0' || type === 0) return 'Text';
		if (type === 'GUILD_VOICE' || type === '2' || type === 2) return 'Voice';
		if (type === 'GUILD_NEWS' || type === '5' || type === 5) return 'Announcement';
		if (type === 'GUILD_STAGE_VOICE' || type === '13' || type === 13) return 'Stage';
		return 'Other';
	}

	const grouped = $derived.by(() => {
		const q = search.trim().toLowerCase();
		const filtered = q ? channels.filter((c) => c.name?.toLowerCase().includes(q) || c.discord_channel_id?.includes(q)) : channels;

		const catMap = new Map<number, Category>();
		categories.forEach((cat) => catMap.set(cat.id, cat));

		const byCategory = new Map<number, Channel[]>();
		const uncategorized: Channel[] = [];

		filtered.forEach((ch) => {
			if (ch.category_id != null && catMap.has(ch.category_id)) {
				if (!byCategory.has(ch.category_id)) byCategory.set(ch.category_id, []);
				byCategory.get(ch.category_id)!.push(ch);
			} else {
				uncategorized.push(ch);
			}
		});

		const sortedCats = categories.filter((cat) => byCategory.has(cat.id)).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

		byCategory.forEach((chs) => chs.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)));
		uncategorized.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

		return { sortedCats, byCategory, uncategorized, catMap };
	});

	function openModal() {
		pending = [...currentIds];
		open = true;
		search = '';
	}

	function toggle(id: string) {
		if (pending.includes(id)) pending = pending.filter((c) => c !== id);
		else pending = [...pending, id];
	}

	function confirm() {
		if (!multi) {
			onchange(pending[0] ?? '');
		} else {
			onchange([...pending]);
		}
		open = false;
		search = '';
	}

	function remove(id: string) {
		onchange((value as string[]).filter((c) => c !== id));
	}

	function close() {
		open = false;
		search = '';
	}

	function channelById(id: string) {
		return channels.find((c) => c.discord_channel_id === id);
	}
</script>

<button
	type="button"
	onclick={openModal}
	class="bg-ash-700 border-ash-600 hover:border-ash-500 flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors"
>
	{#if multi}
		<span class={(value as string[]).length ? 'text-ash-100' : 'text-ash-300'}>
			{(value as string[]).length ? `${(value as string[]).length} channel${(value as string[]).length !== 1 ? 's' : ''} selected` : placeholder}
		</span>
	{:else}
		<span class={selected ? 'text-ash-100' : 'text-ash-300'}>
			{selected ? `#${selected.name}` : placeholder}
		</span>
	{/if}
	<i class={CHANNEL_PICKER_ACCENT.chevron}></i>
</button>

{#if multi && (value as string[]).length > 0}
	<div class="mt-2 flex flex-wrap gap-1">
		{#each value as string[] as id}
			{@const ch = channelById(id)}
			{#if ch}
				<span class="bg-ash-700 text-ash-200 flex items-center gap-1 rounded px-2 py-0.5 text-xs">
					<span class="text-ash-500">#</span>{ch.name}
					<button type="button" onclick={() => remove(id)} class="text-ash-500 hover:text-ash-300 ml-0.5">
						<i class="fas fa-times text-xs"></i>
					</button>
				</span>
			{/if}
		{/each}
	</div>
{/if}

{#if open}
	<div class="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4" onclick={close}>
		<div
			class="bg-ash-800 border-ash-700 my-4 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border p-4 shadow-2xl sm:p-6"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="mb-4 flex items-center justify-between sm:mb-6">
				<h3 class="text-ash-100 flex items-center gap-2 text-lg font-bold sm:text-xl">
					<i class="fas fa-hashtag text-violet-400"></i>
					{multi ? 'Select Channels' : 'Select Channel'}
				</h3>
				<button type="button" onclick={close} aria-label="Close" class="text-ash-400 hover:text-ash-100 p-1 transition-colors">
					<i class="fas fa-times text-lg"></i>
				</button>
			</div>

			<div class="relative mb-4">
				<input
					type="text"
					bind:value={search}
					placeholder="Search channels..."
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-4 py-2.5 pr-10 text-sm transition-all focus:ring-2 focus:outline-none sm:py-3 sm:text-base"
				/>
				<i class="{CHANNEL_PICKER_ACCENT.searchIcon} absolute top-1/2 right-3 -translate-y-1/2"></i>
			</div>

			<div class="min-h-0 flex-1 space-y-2 overflow-y-auto">
				{#if channels.length === 0}
					<div class="text-ash-400 py-8 text-center text-sm">
						<i class="fas fa-inbox {CHANNEL_PICKER_ACCENT.emptyStateIcon}"></i>
						<p>No channels found</p>
					</div>
				{:else}
					{#if !multi}
						<button
							type="button"
							onclick={() => {
								pending = [];
								confirm();
							}}
							class="text-ash-400 hover:bg-ash-700 w-full rounded-lg px-4 py-2.5 text-left text-sm transition-colors {(value as string) === ''
								? 'bg-ash-700'
								: ''}"
						>
							— None —
						</button>
					{/if}

					{#each grouped.sortedCats as cat}
						{@const catChannels = grouped.byCategory.get(cat.id) ?? []}
						{#if catChannels.length > 0}
							<div class="mb-3">
								<div class="mb-2 flex items-center gap-2 px-2">
									<i class="fas fa-folder text-xs text-amber-300"></i>
									<span class="text-ash-400 text-xs font-semibold tracking-wider uppercase">{cat.name ?? 'Unnamed Category'}</span>
								</div>
								<div class="space-y-1">
									{#each catChannels as ch}
										<button
											type="button"
											onclick={() => {
												if (multi) toggle(ch.discord_channel_id);
												else {
													pending = [ch.discord_channel_id];
													confirm();
												}
											}}
											class="flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-left text-sm transition-colors
												{(multi ? pending.includes(ch.discord_channel_id) : (value as string) === ch.discord_channel_id)
												? 'bg-ash-900 border-ash-500 border'
												: 'bg-ash-700 hover:bg-ash-600'}"
										>
											<div class="flex min-w-0 flex-1 items-center gap-3">
												<i class="fas fa-hashtag flex-shrink-0 text-sm text-violet-300"></i>
												<div class="min-w-0 flex-1">
													<p class="text-ash-100 truncate text-sm font-medium">{ch.name}</p>
													<p class="text-ash-400 text-xs">{channelType(ch.type)}</p>
												</div>
											</div>
											{#if multi ? pending.includes(ch.discord_channel_id) : (value as string) === ch.discord_channel_id}
												<i class="fas fa-check text-sm text-emerald-300"></i>
											{:else}
												<i class="fas fa-chevron-right text-xs {CHANNEL_PICKER_ACCENT.listChevron}"></i>
											{/if}
										</button>
									{/each}
								</div>
							</div>
						{/if}
					{/each}

					{#if grouped.uncategorized.length > 0}
						{#if grouped.sortedCats.length > 0}
							<div class="border-ash-700 my-3 border-t"></div>
						{/if}
						<div class="mb-3">
							<div class="mb-2 flex items-center gap-2 px-2">
								<i class="fas fa-hashtag text-xs text-violet-300"></i>
								<span class="text-ash-400 text-xs font-semibold tracking-wider uppercase">No Category</span>
							</div>
							<div class="space-y-1">
								{#each grouped.uncategorized as ch}
									<button
										type="button"
										onclick={() => {
											if (multi) toggle(ch.discord_channel_id);
											else {
												pending = [ch.discord_channel_id];
												confirm();
											}
										}}
										class="flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-left text-sm transition-colors
											{(multi ? pending.includes(ch.discord_channel_id) : (value as string) === ch.discord_channel_id)
											? 'bg-ash-900 border-ash-500 border'
											: 'bg-ash-700 hover:bg-ash-600'}"
									>
										<div class="flex min-w-0 flex-1 items-center gap-3">
											<i class="fas fa-hashtag flex-shrink-0 text-sm text-violet-300"></i>
											<div class="min-w-0 flex-1">
												<p class="text-ash-100 truncate text-sm font-medium">{ch.name}</p>
												<p class="text-ash-400 text-xs">{channelType(ch.type)}</p>
											</div>
										</div>
										{#if multi ? pending.includes(ch.discord_channel_id) : (value as string) === ch.discord_channel_id}
											<i class="fas fa-check text-sm text-emerald-300"></i>
										{:else}
											<i class="fas fa-chevron-right text-xs {CHANNEL_PICKER_ACCENT.listChevron}"></i>
										{/if}
									</button>
								{/each}
							</div>
						</div>
					{/if}

					{#if grouped.sortedCats.length === 0 && grouped.uncategorized.length === 0}
						<p class="text-ash-500 py-4 text-center text-sm">No channels match your search</p>
					{/if}
				{/if}
			</div>
			{#if multi}
				<div class="border-ash-700 mt-4 border-t pt-4">
					<button
						type="button"
						onclick={confirm}
						class="bg-ash-400 hover:bg-ash-500 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all sm:py-3 sm:text-base"
					>
						<i class="fas fa-check text-emerald-300"></i>Confirm Selection
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
