<script lang="ts">
	interface Category {
		id: number;
		discord_category_id: string;
		name: string;
		position: number | null;
	}

	interface Props {
		categories: Category[];
		value: string[];
		onchange: (ids: string[]) => void;
	}

	let { categories, value, onchange }: Props = $props();

	let open = $state(false);
	let search = $state('');
	let pending = $state<string[]>([]);

	const filtered = $derived(search.trim() ? categories.filter((c) => c.name?.toLowerCase().includes(search.toLowerCase())) : categories);

	function categoryById(id: string) {
		return categories.find((c) => c.discord_category_id === id);
	}

	function openModal() {
		pending = [...value];
		open = true;
		search = '';
	}

	function toggle(id: string) {
		if (pending.includes(id)) pending = pending.filter((c) => c !== id);
		else pending = [...pending, id];
	}

	function confirm() {
		onchange([...pending]);
		open = false;
		search = '';
	}

	function remove(id: string) {
		onchange(value.filter((c) => c !== id));
	}

	function close() {
		open = false;
		search = '';
	}
</script>

<button
	type="button"
	onclick={openModal}
	class="bg-ash-700 border-ash-600 hover:border-ash-500 flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors"
>
	<span class={value.length ? 'text-ash-100' : 'text-ash-300'}>
		{value.length ? `${value.length} categor${value.length !== 1 ? 'ies' : 'y'} selected` : 'Select categories...'}
	</span>
	<i class="fas fa-chevron-down text-ash-400 text-xs"></i>
</button>

{#if value.length > 0}
	<div class="mt-2 flex flex-wrap gap-1.5">
		{#each value as id}
			{@const cat = categoryById(id)}
			<span class="bg-ash-600 text-ash-100 flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs">
				<i class="fas fa-folder text-xs"></i>
				{cat ? cat.name : `Category ${id}`}
				<button type="button" onclick={() => remove(id)} class="hover:text-ash-300 ml-0.5 transition-colors">
					<i class="fas fa-times text-xs"></i>
				</button>
			</span>
		{/each}
	</div>
{/if}

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4" onclick={close}>
		<div
			class="bg-ash-800 border-ash-700 my-4 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border p-4 shadow-2xl sm:p-6"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="mb-4 flex items-center justify-between sm:mb-6">
				<h3 class="text-ash-100 flex items-center gap-2 text-lg font-bold sm:text-xl">
					<i class="fas fa-folder text-ash-200"></i>Select Categories
				</h3>
				<button type="button" onclick={close} class="text-ash-400 hover:text-ash-100 p-1 transition-colors">
					<i class="fas fa-times text-lg"></i>
				</button>
			</div>
			<!-- Search -->
			<div class="relative mb-4">
				<input
					type="text"
					bind:value={search}
					placeholder="Search categories..."
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-4 py-2.5 pr-10 text-sm transition-all focus:ring-2 focus:outline-none sm:py-3 sm:text-base"
				/>
				<i class="fas fa-search text-ash-400 absolute top-1/2 right-3 -translate-y-1/2"></i>
			</div>
			<!-- Category list -->
			<div class="min-h-0 flex-1 space-y-1 overflow-y-auto">
				{#if filtered.length === 0}
					<div class="text-ash-400 py-8 text-center text-sm">
						<i class="fas fa-inbox mb-2 text-3xl"></i>
						<p>No categories found</p>
					</div>
				{:else}
					{#each filtered as cat}
						{@const isSelected = pending.includes(cat.discord_category_id)}
						<button
							type="button"
							onclick={() => toggle(cat.discord_category_id)}
							class="flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-left text-sm transition-colors
								{isSelected ? 'bg-ash-900 border-ash-500 border' : 'bg-ash-700 hover:bg-ash-600'}"
						>
							<div class="flex min-w-0 flex-1 items-center gap-3">
								<i class="fas fa-folder {isSelected ? 'text-ash-300' : 'text-ash-400'} flex-shrink-0"></i>
								<p class="{isSelected ? 'text-ash-100' : 'text-ash-300'} truncate text-sm">{cat.name ?? 'Unnamed Category'}</p>
							</div>
							{#if isSelected}
								<i class="fas fa-check text-ash-200 text-sm"></i>
							{:else}
								<i class="fas fa-check text-sm text-transparent"></i>
							{/if}
						</button>
					{/each}
				{/if}
			</div>
			<!-- Confirm -->
			<div class="border-ash-700 mt-4 border-t pt-4">
				<button
					type="button"
					onclick={confirm}
					class="bg-ash-400 hover:bg-ash-500 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all sm:py-3 sm:text-base"
				>
					<i class="fas fa-check"></i>Confirm Selection
				</button>
			</div>
		</div>
	</div>
{/if}
