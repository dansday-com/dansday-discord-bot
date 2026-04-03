<script lang="ts">
	import { dbDateTimeToMs } from '$lib/utils/datetime.js';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';

	export type Member = {
		discord_member_id: string;
		username: string;
		display_name: string;
		server_display_name: string;
		avatar: string | null;
		level: number;
		experience: number;
		rank: number;
		chat_total: number;
		voice_minutes_active: number;
		voice_minutes_afk: number;
		is_afk: boolean;
		member_since: string;
		profile_created_at: string;
		roles: { id: string; name: string; color: string }[];
	};

	interface Props {
		members: Member[];
		/** When set (including `[]`), only members with any of these Discord role IDs are shown. Omit for “all members”. */
		filterRoleIds?: string[];
		/** Shown when `filterRoleIds` is set but empty (no roles configured in Permissions). */
		permissionsHref?: string;
	}

	let { members, filterRoleIds, permissionsHref }: Props = $props();

	const MEMBERS_PER_PAGE = 20;

	let search = $state('');
	let sortBy = $state('rank_asc');
	let page = $state(1);

	function matchesRoleFilter(member: Member, roleIds: string[] | undefined): boolean {
		if (roleIds === undefined) return true;
		if (!roleIds.length) return false;
		return member.roles?.some((r) => roleIds.includes(r.id)) ?? false;
	}

	const roleFilterUnset = $derived(filterRoleIds !== undefined && filterRoleIds.length === 0);

	const filtered = $derived(
		members.filter((m) => {
			const q = search.toLowerCase();
			const matchSearch =
				!q ||
				m.username?.toLowerCase().includes(q) ||
				m.display_name?.toLowerCase().includes(q) ||
				m.server_display_name?.toLowerCase().includes(q) ||
				m.discord_member_id?.includes(q);
			return matchSearch && matchesRoleFilter(m, filterRoleIds);
		})
	);

	const sorted = $derived(
		[...filtered].sort((a, b) => {
			switch (sortBy) {
				case 'rank_asc':
					return (a.rank ?? 9999) - (b.rank ?? 9999);
				case 'rank_desc':
					return (b.rank ?? 9999) - (a.rank ?? 9999);
				case 'level_desc':
					return (b.level ?? 0) - (a.level ?? 0);
				case 'level_asc':
					return (a.level ?? 0) - (b.level ?? 0);
				case 'xp_desc':
					return (b.experience ?? 0) - (a.experience ?? 0);
				case 'xp_asc':
					return (a.experience ?? 0) - (b.experience ?? 0);
				case 'chat_desc':
					return (b.chat_total ?? 0) - (a.chat_total ?? 0);
				case 'chat_asc':
					return (a.chat_total ?? 0) - (b.chat_total ?? 0);
				case 'voice_active_desc':
					return (b.voice_minutes_active ?? 0) - (a.voice_minutes_active ?? 0);
				case 'voice_active_asc':
					return (a.voice_minutes_active ?? 0) - (b.voice_minutes_active ?? 0);
				case 'voice_afk_desc':
					return (b.voice_minutes_afk ?? 0) - (a.voice_minutes_afk ?? 0);
				case 'voice_afk_asc':
					return (a.voice_minutes_afk ?? 0) - (b.voice_minutes_afk ?? 0);
				case 'name_asc':
					return (a.username ?? '').localeCompare(b.username ?? '');
				case 'name_desc':
					return (b.username ?? '').localeCompare(a.username ?? '');
				case 'member_since_asc':
					return dbDateTimeToMs(a.member_since) - dbDateTimeToMs(b.member_since);
				case 'member_since_desc':
					return dbDateTimeToMs(b.member_since) - dbDateTimeToMs(a.member_since);
				case 'account_created_asc':
					return dbDateTimeToMs(a.profile_created_at) - dbDateTimeToMs(b.profile_created_at);
				case 'account_created_desc':
					return dbDateTimeToMs(b.profile_created_at) - dbDateTimeToMs(a.profile_created_at);
				case 'afk_first':
					return (b.is_afk ? 1 : 0) - (a.is_afk ? 1 : 0);
				case 'afk_last':
					return (a.is_afk ? 1 : 0) - (b.is_afk ? 1 : 0);
				default:
					return 0;
			}
		})
	);

	const totalPages = $derived(Math.ceil(sorted.length / MEMBERS_PER_PAGE));
	const paged = $derived(sorted.slice((page - 1) * MEMBERS_PER_PAGE, page * MEMBERS_PER_PAGE));

	function onSearchInput() {
		page = 1;
	}

	function fmtNum(n: number): string {
		if (n == null) return '0';
		return n.toLocaleString();
	}

	function roleColor(hex: string): string {
		if (!hex || hex === '#000000' || hex === '0' || hex === 'null') return '#99AAB5';
		if (hex.startsWith('#')) return hex;
		if (/^[0-9A-Fa-f]{6}$/.test(hex)) return `#${hex}`;
		const num = parseInt(hex, 10);
		if (!isNaN(num) && num !== 0) return `#${num.toString(16).padStart(6, '0')}`;
		return '#99AAB5';
	}

	function displayName(m: Member): string {
		if (m.server_display_name?.trim()) return m.server_display_name;
		if (m.display_name?.trim()) return m.display_name;
		return m.username ?? 'Unknown';
	}

	function avatarSrc(m: Member): string {
		return m.avatar ?? `https://cdn.discordapp.com/embed/avatars/${Number(m.discord_member_id) % 5 || 0}.png`;
	}
</script>

<div class="mb-4 flex flex-col gap-3 sm:flex-row">
	<div class="relative flex-1">
		<i class="fas fa-search absolute top-1/2 left-3 -translate-y-1/2 text-sm text-cyan-300"></i>
		<input
			type="text"
			placeholder="Search members by name or ID..."
			bind:value={search}
			oninput={onSearchInput}
			class="bg-ash-800 border-ash-700 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border py-2.5 pr-4 pl-9 text-sm focus:ring-2 focus:outline-none"
		/>
	</div>
	<select
		bind:value={sortBy}
		class="bg-ash-800 border-ash-700 text-ash-100 focus:ring-ash-500 rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
	>
		<option value="rank_asc">Rank (Low → High)</option>
		<option value="rank_desc">Rank (High → Low)</option>
		<option value="level_desc">Level (High → Low)</option>
		<option value="level_asc">Level (Low → High)</option>
		<option value="xp_desc">XP (High → Low)</option>
		<option value="xp_asc">XP (Low → High)</option>
		<option value="chat_desc">Chat Messages (High → Low)</option>
		<option value="chat_asc">Chat Messages (Low → High)</option>
		<option value="voice_active_desc">Voice Active (High → Low)</option>
		<option value="voice_active_asc">Voice Active (Low → High)</option>
		<option value="voice_afk_desc">Voice AFK (High → Low)</option>
		<option value="voice_afk_asc">Voice AFK (Low → High)</option>
		<option value="name_asc">Name (A-Z)</option>
		<option value="name_desc">Name (Z-A)</option>
		<option value="member_since_asc">Member Since (Oldest First)</option>
		<option value="member_since_desc">Member Since (Newest First)</option>
		<option value="account_created_asc">Account Created (Oldest First)</option>
		<option value="account_created_desc">Account Created (Newest First)</option>
		<option value="afk_first">AFK Status (AFK First)</option>
		<option value="afk_last">AFK Status (Non-AFK First)</option>
	</select>
</div>

<p class="text-ash-500 mb-3 text-xs">
	{sorted.length} member{sorted.length !== 1 ? 's' : ''}{search ? ` matching "${search}"` : ''}
</p>

{#if roleFilterUnset}
	<div class="text-ash-400 border-ash-600 bg-ash-800/60 mb-4 rounded-lg border px-4 py-3 text-sm">
		<p class="text-ash-300 mb-1">No roles are set for this category in Permissions yet.</p>
		<p class="text-ash-500 text-xs">Choose Discord roles under Configuration → Permissions so this list can filter members.</p>
		{#if permissionsHref}
			<a href={permissionsHref} class="text-ash-300 hover:text-ash-100 mt-2 inline-flex items-center gap-1.5 text-xs font-medium underline">
				<i class="fas fa-shield-halved text-blue-300"></i>Open Permissions
			</a>
		{/if}
	</div>
{:else if paged.length === 0}
	<div class="text-ash-400 py-10 text-center text-sm">No members found</div>
{:else}
	<div class="mb-4 space-y-3">
		{#each paged as member (member.discord_member_id)}
			<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-4 shadow-lg transition-all sm:p-5">
				<div class="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
					<div class="relative shrink-0">
						<img
							src={avatarSrc(member)}
							alt={displayName(member)}
							class="border-ash-600 h-20 w-20 rounded-full border-2 object-cover"
							onerror={(e) => ((e.currentTarget as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png')}
						/>
						{#if member.is_afk}
							<div class="border-ash-700 absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-yellow-500">
								<i class="fas fa-moon text-ash-950 text-xs"></i>
							</div>
						{/if}
					</div>

					<div class="w-full min-w-0 flex-1 text-center sm:text-left">
						<div class="mb-3 flex flex-col items-center gap-2 sm:flex-row sm:items-center">
							<h4 class="text-ash-100 w-full truncate text-base font-bold sm:w-auto sm:text-lg">
								{displayName(member)}
								{#if member.is_afk}
									<span class="ml-1 text-xs text-yellow-400">(AFK)</span>
								{/if}
							</h4>
							{#if member.is_afk}
								<span class="flex items-center gap-1 self-center rounded-full bg-yellow-900 px-2 py-1 text-xs font-medium text-yellow-200">
									<i class="fas fa-moon text-xs"></i>AFK
								</span>
							{/if}
						</div>

						<div class="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-4">
							<div class="bg-ash-800 border-ash-600 flex items-center gap-2 rounded-lg border p-2">
								<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/20">
									<i class="fas fa-medal text-xs text-sky-400"></i>
								</div>
								<div class="min-w-0">
									<div class="text-ash-400 text-[0.6rem] tracking-wide uppercase">Rank</div>
									<div class="text-ash-100 text-sm font-bold">{member.rank ? `#${member.rank}` : 'N/A'}</div>
								</div>
							</div>
							<div class="bg-ash-800 border-ash-600 flex items-center gap-2 rounded-lg border p-2">
								<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
									<i class="fas fa-trophy text-xs text-amber-400"></i>
								</div>
								<div class="min-w-0">
									<div class="text-ash-400 text-[0.6rem] tracking-wide uppercase">Level</div>
									<div class="text-ash-100 text-sm font-bold">{member.level ?? 1}</div>
								</div>
							</div>
							<div class="bg-ash-800 border-ash-600 flex items-center gap-2 rounded-lg border p-2">
								<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/20">
									<i class="fas fa-star text-xs text-violet-400"></i>
								</div>
								<div class="min-w-0">
									<div class="text-ash-400 text-[0.6rem] tracking-wide uppercase">XP</div>
									<div class="text-ash-100 text-sm font-bold">{fmtNum(member.experience ?? 0)}</div>
								</div>
							</div>
							<div class="bg-ash-800 border-ash-600 flex items-center gap-2 rounded-lg border p-2">
								<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
									<i class="fas fa-comment text-xs text-emerald-400"></i>
								</div>
								<div class="min-w-0">
									<div class="text-ash-400 text-[0.6rem] tracking-wide uppercase">Chat</div>
									<div class="text-ash-100 text-sm font-bold">{fmtNum(member.chat_total ?? 0)}</div>
								</div>
							</div>
							<div class="bg-ash-800 border-ash-600 flex items-center gap-2 rounded-lg border p-2">
								<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20">
									<i class="fas fa-microphone text-xs text-cyan-400"></i>
								</div>
								<div class="min-w-0">
									<div class="text-ash-400 text-[0.6rem] tracking-wide uppercase">Voice Active</div>
									<div class="text-ash-100 text-sm font-bold">{fmtNum(member.voice_minutes_active ?? 0)}m</div>
								</div>
							</div>
							<div class="bg-ash-800 border-ash-600 flex items-center gap-2 rounded-lg border p-2">
								<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/20">
									<i class="fas fa-moon text-xs text-orange-400"></i>
								</div>
								<div class="min-w-0">
									<div class="text-ash-400 text-[0.6rem] tracking-wide uppercase">Voice AFK</div>
									<div class="text-ash-100 text-sm font-bold">{fmtNum(member.voice_minutes_afk ?? 0)}m</div>
								</div>
							</div>
							<div class="bg-ash-800 border-ash-600 flex items-center gap-2 rounded-lg border p-2">
								<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20">
									<i class="fas fa-calendar-alt text-xs text-indigo-400"></i>
								</div>
								<div class="min-w-0">
									<div class="text-ash-400 text-[0.6rem] tracking-wide uppercase">Member Since</div>
									<div class="text-ash-100 text-sm font-bold">
										<LocalTime value={member.member_since} fallback="N/A" />
									</div>
								</div>
							</div>
							<div class="bg-ash-800 border-ash-600 flex items-center gap-2 rounded-lg border p-2">
								<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/20">
									<i class="fas fa-user-plus text-xs text-rose-400"></i>
								</div>
								<div class="min-w-0">
									<div class="text-ash-400 text-[0.6rem] tracking-wide uppercase">Account Created</div>
									<div class="text-ash-100 text-sm font-bold">
										<LocalTime value={member.profile_created_at} fallback="N/A" />
									</div>
								</div>
							</div>
						</div>

						{#if member.roles?.length > 0}
							<div class="border-ash-600 mt-2 border-t pt-2">
								<div class="mb-1.5 flex items-center gap-1.5">
									<i class="fas fa-user-tag text-xs text-green-300"></i>
									<span class="text-ash-400 text-xs tracking-wide uppercase">Roles</span>
								</div>
								<div class="flex flex-wrap gap-1.5">
									{#each member.roles as role}
										{@const c = roleColor(role.color)}
										<span
											class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium"
											style="background:{c}20;color:{c};border:1px solid {c}40"
										>
											<i class="fas fa-circle text-[0.4rem]" style="color:{c}"></i>
											{role.name || 'Unknown Role'}
										</span>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>

	{#if totalPages > 1}
		<div class="flex items-center justify-between">
			<button
				onclick={() => (page = Math.max(1, page - 1))}
				disabled={page === 1}
				class="bg-ash-800 border-ash-700 hover:bg-ash-700 text-ash-200 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
			>
				<i class="fas fa-chevron-left text-xs text-violet-300"></i>Previous
			</button>
			<span class="text-ash-400 text-sm">Page {page} of {totalPages}</span>
			<button
				onclick={() => (page = Math.min(totalPages, page + 1))}
				disabled={page === totalPages}
				class="bg-ash-800 border-ash-700 hover:bg-ash-700 text-ash-200 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
			>
				Next<i class="fas fa-chevron-right text-xs text-violet-300"></i>
			</button>
		</div>
	{/if}
{/if}
