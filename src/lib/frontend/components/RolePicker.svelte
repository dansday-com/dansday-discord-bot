<script lang="ts">
	import { ROLE_PICKER_ACCENT } from '$lib/frontend/controlAccents.js';

	interface Role {
		discord_role_id: string;
		name: string;
		color: string;
		position: number | null;
	}

	interface Props {
		roles: Role[];
		value: string | string[];
		placeholder?: string;
		single?: boolean;
		onchange: (value: string | string[]) => void;
	}

	let { roles, value, placeholder = 'Select roles...', single = false, onchange }: Props = $props();

	let open = $state(false);
	let search = $state('');
	let pending = $state<string[]>([]);

	const sortedRoles = $derived([...roles].sort((a, b) => (b.position ?? 0) - (a.position ?? 0)));
	const filtered = $derived(search.trim() ? sortedRoles.filter((r) => r.name?.toLowerCase().includes(search.toLowerCase())) : sortedRoles);

	function roleColor(hex: string) {
		return !hex || hex === '#000000' ? '#6b7280' : hex;
	}

	const currentIds = $derived(single ? (value ? [value as string] : []) : (value as string[]));

	function openModal() {
		pending = [...currentIds];
		open = true;
		search = '';
	}

	function toggle(id: string) {
		if (single) {
			if (pending[0] === id) {
				pending = [];
			} else {
				pending = [id];
			}
		} else {
			if (pending.includes(id)) pending = pending.filter((r) => r !== id);
			else pending = [...pending, id];
		}
	}

	function confirm() {
		if (single) {
			onchange(pending[0] ?? '');
		} else {
			onchange([...pending]);
		}
		open = false;
		search = '';
	}

	function remove(id: string) {
		if (single) {
			onchange('');
		} else {
			onchange((value as string[]).filter((r) => r !== id));
		}
	}

	function close() {
		open = false;
		search = '';
	}

	function roleById(id: string) {
		return roles.find((r) => r.discord_role_id === id);
	}
</script>

<button
	type="button"
	onclick={openModal}
	class="bg-ash-700 border-ash-600 hover:border-ash-500 flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors"
>
	{#if single}
		{@const r = value ? roleById(value as string) : null}
		{#if r}
			<span class="text-ash-100 flex items-center gap-2">
				<span class="h-3 w-3 shrink-0 rounded-full" style="background:{roleColor(r.color)}"></span>
				{r.name}
			</span>
		{:else}
			<span class="text-ash-300">{placeholder}</span>
		{/if}
	{:else}
		<span class={(value as string[]).length ? 'text-ash-100' : 'text-ash-300'}>
			{(value as string[]).length ? `${(value as string[]).length} role${(value as string[]).length !== 1 ? 's' : ''} selected` : placeholder}
		</span>
	{/if}
	<i class={ROLE_PICKER_ACCENT.chevron}></i>
</button>

{#if !single && (value as string[]).length > 0}
	<div class="mt-2 flex flex-wrap gap-1">
		{#each value as string[] as id}
			{@const role = roleById(id)}
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
	<div class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4" onclick={close}>
		<div
			class="bg-ash-800 border-ash-700 my-4 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border p-4 shadow-2xl sm:p-6"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="mb-4 flex items-center justify-between sm:mb-6">
				<h3 class="text-ash-100 flex items-center gap-2 text-lg font-bold sm:text-xl">
					<i class="fas fa-user-shield text-blue-400"></i>
					{single ? 'Select Role' : 'Select Roles'}
				</h3>
				<button type="button" onclick={close} aria-label="Close" class="text-ash-400 hover:text-ash-100 p-1 transition-colors">
					<i class="fas fa-times text-lg"></i>
				</button>
			</div>
			<div class="relative mb-4">
				<input
					type="text"
					bind:value={search}
					placeholder="Search roles..."
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-4 py-2.5 pr-10 text-sm transition-all focus:ring-2 focus:outline-none sm:py-3 sm:text-base"
				/>
				<i class="{ROLE_PICKER_ACCENT.searchIcon} absolute top-1/2 right-3 -translate-y-1/2"></i>
			</div>
			<div class="min-h-0 flex-1 space-y-1 overflow-y-auto">
				{#if filtered.length === 0}
					<div class="text-ash-400 py-8 text-center text-sm">
						<i class="fas fa-inbox {ROLE_PICKER_ACCENT.emptyStateIcon}"></i>
						<p>No roles found</p>
					</div>
				{:else}
					{#each filtered as role}
						{@const isSelected = pending.includes(role.discord_role_id)}
						<button
							type="button"
							onclick={() => toggle(role.discord_role_id)}
							class="flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-left text-sm transition-colors
								{isSelected ? 'bg-ash-900 border-ash-500 border' : 'bg-ash-700 hover:bg-ash-600'}"
						>
							<div class="flex min-w-0 flex-1 items-center gap-3">
								<span class="h-4 w-4 shrink-0 rounded-full" style="background:{roleColor(role.color)}"></span>
								<p class="{isSelected ? 'text-ash-100' : 'text-ash-300'} truncate text-sm font-medium">{role.name}</p>
							</div>
							{#if isSelected}
								<i class="fas fa-check text-sm text-emerald-300"></i>
							{:else}
								<i class="fas fa-check text-sm text-transparent"></i>
							{/if}
						</button>
					{/each}
				{/if}
			</div>

			<div class="border-ash-700 mt-4 border-t pt-4">
				<button
					type="button"
					onclick={confirm}
					class="bg-ash-400 hover:bg-ash-500 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all sm:py-3 sm:text-base"
				>
					<i class="fas fa-check text-emerald-300"></i>Confirm Selection
				</button>
			</div>
		</div>
	</div>
{/if}
