<script lang="ts">
	interface Role {
		id: string;
		name: string;
		color: string;
	}
	interface Props {
		roles: Role[];
		value: string[];
		placeholder?: string;
		onchange: (ids: string[]) => void;
	}
	let { roles, value, placeholder = 'Select roles...', onchange }: Props = $props();
	let open = $state(false);
	let search = $state('');
	let pending = $state<string[]>([]);

	const filtered = $derived(search.trim() ? roles.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())) : roles);

	function roleColor(hex: string) {
		return !hex || hex === '#000000' ? '#6b7280' : hex;
	}

	function openModal() {
		pending = [...value];
		open = true;
		search = '';
	}

	function toggle(id: string) {
		if (pending.includes(id)) pending = pending.filter((r) => r !== id);
		else pending = [...pending, id];
	}

	function confirm() {
		onchange(pending);
		open = false;
		search = '';
	}

	function remove(id: string) {
		onchange(value.filter((r) => r !== id));
	}
</script>

<button
	type="button"
	onclick={openModal}
	class="bg-ash-700 border-ash-600 hover:border-ash-500 flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors"
>
	<span class={value.length ? 'text-ash-100' : 'text-ash-300'}>
		{value.length ? `${value.length} role${value.length !== 1 ? 's' : ''} selected` : placeholder}
	</span>
	<i class="fas fa-chevron-down text-ash-400 text-xs"></i>
</button>

{#if value.length > 0}
	<div class="mt-2 flex flex-wrap gap-1">
		{#each value as id}
			{@const role = roles.find((r) => r.id === id)}
			{#if role}
				<span
					class="flex items-center gap-1 rounded border px-2 py-0.5 text-xs"
					style="color:{roleColor(role.color)};border-color:{roleColor(role.color)}44;background:{roleColor(role.color)}11"
				>
					{role.name}
					<button type="button" onclick={() => remove(id)} class="ml-0.5 hover:opacity-70">
						<i class="fas fa-times text-xs"></i>
					</button>
				</span>
			{/if}
		{/each}
	</div>
{/if}

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
		onclick={() => {
			open = false;
			search = '';
		}}
	>
		<div
			class="bg-ash-800 border-ash-700 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border p-4 shadow-2xl sm:p-6"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="mb-4 flex items-center justify-between sm:mb-6">
				<h3 class="text-ash-100 flex items-center gap-2 text-lg font-bold sm:text-xl">
					<i class="fas fa-user-shield text-ash-200"></i>Select Roles
				</h3>
				<button
					type="button"
					onclick={() => {
						open = false;
						search = '';
					}}
					class="text-ash-400 hover:text-ash-100 p-1 transition-colors"
				>
					<i class="fas fa-times text-lg"></i>
				</button>
			</div>
			<div class="relative mb-4">
				<input
					type="text"
					bind:value={search}
					placeholder="Search roles..."
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-4 py-2.5 pr-10 text-sm focus:ring-2 focus:outline-none sm:py-3 sm:text-base"
				/>
				<i class="fas fa-search text-ash-400 absolute top-1/2 right-3 -translate-y-1/2"></i>
			</div>
			<div class="min-h-0 flex-1 space-y-1 overflow-y-auto">
				{#each filtered as role}
					<button
						type="button"
						onclick={() => toggle(role.id)}
						class="hover:bg-ash-700 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors
							{pending.includes(role.id) ? 'bg-ash-700' : ''}"
					>
						<i class="fas {pending.includes(role.id) ? 'fa-check-square text-ash-200' : 'fa-square text-ash-500'} w-3 text-xs"></i>
						<span class="h-2 w-2 shrink-0 rounded-full" style="background:{roleColor(role.color)}"></span>
						<span class={pending.includes(role.id) ? 'text-ash-100' : 'text-ash-300'}>{role.name}</span>
					</button>
				{/each}
				{#if filtered.length === 0}
					<p class="text-ash-500 py-4 text-center text-sm">No roles found</p>
				{/if}
			</div>
			<div class="border-ash-700 mt-4 border-t pt-4">
				<button
					type="button"
					onclick={confirm}
					class="bg-ash-500 hover:bg-ash-400 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all sm:py-3 sm:text-base"
				>
					<i class="fas fa-check"></i>Confirm Selection
				</button>
			</div>
		</div>
	</div>
{/if}
