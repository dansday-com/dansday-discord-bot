<script lang="ts">
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
		filterRoleIds?: string[];
	}

	let { members, filterRoleIds = [] }: Props = $props();

	const MEMBERS_PER_PAGE = 20;

	let search = $state('');
	let sortBy = $state('rank_asc');
	let page = $state(1);

	function hasRole(member: Member, roleIds: string[]): boolean {
		if (!roleIds.length) return true;
		return member.roles?.some((r) => roleIds.includes(r.id)) ?? false;
	}

	const filtered = $derived(
		members.filter((m) => {
			const q = search.toLowerCase();
			const matchSearch =
				!q ||
				m.username?.toLowerCase().includes(q) ||
				m.display_name?.toLowerCase().includes(q) ||
				m.server_display_name?.toLowerCase().includes(q) ||
				m.discord_member_id?.includes(q);
			return matchSearch && hasRole(m, filterRoleIds);
		})
	);

	const sorted = $derived(
		[...filtered].sort((a, b) => {
			switch (sortBy) {
				case 'rank_asc': return (a.rank ?? 9999) - (b.rank ?? 9999);
				case 'rank_desc': return (b.rank ?? 9999) - (a.rank ?? 9999);
				case 'level_desc': return (b.level ?? 0) - (a.level ?? 0);
				case 'level_asc': return (a.level ?? 0) - (b.level ?? 0);
				case 'xp_desc': return (b.experience ?? 0) - (a.experience ?? 0);
				case 'xp_asc': return (a.experience ?? 0) - (b.experience ?? 0);
				case 'chat_desc': return (b.chat_total ?? 0) - (a.chat_total ?? 0);
				case 'name_asc': return (a.username ?? '').localeCompare(b.username ?? '');
				case 'name_desc': return (b.username ?? '').localeCompare(a.username ?? '');
				case 'voice_desc': return (b.voice_minutes_active ?? 0) - (a.voice_minutes_active ?? 0);
				case 'member_since_asc': return new Date(a.member_since).getTime() - new Date(b.member_since).getTime();
				case 'member_since_desc': return new Date(b.member_since).getTime() - new Date(a.member_since).getTime();
				default: return 0;
			}
		})
	);

	const totalPages = $derived(Math.ceil(sorted.length / MEMBERS_PER_PAGE));
	const paged = $derived(sorted.slice((page - 1) * MEMBERS_PER_PAGE, page * MEMBERS_PER_PAGE));

	function onSearchInput() { page = 1; }

	function fmtDate(val: string): string {
		if (!val) return '—';
		return new Date(val).toLocaleDateString();
	}

	function roleColor(hex: string): string {
		if (!hex || hex === '#000000') return '#6b7280';
		return hex;
	}
</script>

<!-- Controls -->
<div class="flex flex-col sm:flex-row gap-3 mb-4">
	<div class="relative flex-1">
		<i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-ash-500 text-sm"></i>
		<input
			type="text"
			placeholder="Search members..."
			bind:value={search}
			oninput={onSearchInput}
			class="w-full pl-9 pr-4 py-2 bg-ash-800 border border-ash-700 rounded-lg text-ash-100 placeholder-ash-500 text-sm focus:outline-none focus:ring-2 focus:ring-ash-500"
		/>
	</div>
	<select
		bind:value={sortBy}
		class="bg-ash-800 border border-ash-700 text-ash-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ash-500"
	>
		<option value="rank_asc">Rank (Low → High)</option>
		<option value="rank_desc">Rank (High → Low)</option>
		<option value="level_desc">Level (High → Low)</option>
		<option value="level_asc">Level (Low → High)</option>
		<option value="xp_desc">XP (High → Low)</option>
		<option value="xp_asc">XP (Low → High)</option>
		<option value="chat_desc">Most Messages</option>
		<option value="voice_desc">Most Voice Time</option>
		<option value="name_asc">Name (A-Z)</option>
		<option value="name_desc">Name (Z-A)</option>
		<option value="member_since_asc">Oldest Member</option>
		<option value="member_since_desc">Newest Member</option>
	</select>
</div>

<!-- Count -->
<p class="text-xs text-ash-500 mb-3">
	{sorted.length} member{sorted.length !== 1 ? 's' : ''}
	{#if search} matching "{search}"{/if}
</p>

<!-- Member List -->
{#if paged.length === 0}
	<div class="text-center py-10 text-ash-400 text-sm">No members found</div>
{:else}
	<div class="space-y-2 mb-4">
		{#each paged as member (member.discord_member_id)}
			<div class="bg-ash-800 border border-ash-700 rounded-xl p-3 sm:p-4 flex items-start gap-3">
				<!-- Avatar -->
				<div class="relative flex-shrink-0">
					<div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-ash-600 overflow-hidden flex items-center justify-center">
						{#if member.avatar}
							<img src={member.avatar} alt={member.username} class="w-full h-full object-cover" />
						{:else}
							<i class="fas fa-user text-ash-300 text-sm"></i>
						{/if}
					</div>
					{#if member.is_afk}
						<span class="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-ash-800 rounded-full flex items-center justify-center">
							<i class="fas fa-moon text-ash-400 text-xs"></i>
						</span>
					{/if}
				</div>

				<!-- Info -->
				<div class="flex-1 min-w-0">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<p class="text-sm font-semibold text-ash-100 truncate">
								{member.server_display_name || member.display_name || member.username}
								{#if member.is_afk}
									<span class="text-xs text-ash-500 ml-1">(AFK)</span>
								{/if}
							</p>
							<p class="text-xs text-ash-500 truncate">@{member.username}</p>
						</div>
						{#if member.rank}
							<span class="text-xs text-ash-400 flex-shrink-0">#{member.rank}</span>
						{/if}
					</div>

					<!-- Stats -->
					<div class="flex flex-wrap gap-3 mt-2 text-xs text-ash-400">
						{#if member.level != null}
							<span><i class="fas fa-star mr-1 text-yellow-500"></i>Lv {member.level}</span>
						{/if}
						{#if member.experience != null}
							<span><i class="fas fa-bolt mr-1 text-ash-500"></i>{member.experience.toLocaleString()} XP</span>
						{/if}
						{#if member.chat_total != null}
							<span><i class="fas fa-message mr-1"></i>{member.chat_total.toLocaleString()}</span>
						{/if}
						{#if member.voice_minutes_active != null}
							<span><i class="fas fa-microphone mr-1"></i>{member.voice_minutes_active.toLocaleString()}m</span>
						{/if}
						{#if member.member_since}
							<span><i class="fas fa-calendar mr-1"></i>{fmtDate(member.member_since)}</span>
						{/if}
					</div>

					<!-- Roles -->
					{#if member.roles?.length > 0}
						<div class="flex flex-wrap gap-1 mt-2">
							{#each member.roles.slice(0, 6) as role}
								<span
									class="text-xs px-1.5 py-0.5 rounded border"
									style="color:{roleColor(role.color)};border-color:{roleColor(role.color)}33;background:{roleColor(role.color)}11"
								>
									{role.name}
								</span>
							{/each}
							{#if member.roles.length > 6}
								<span class="text-xs text-ash-500 px-1.5 py-0.5">+{member.roles.length - 6}</span>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- Pagination -->
	{#if totalPages > 1}
		<div class="flex items-center justify-between">
			<button
				onclick={() => (page = Math.max(1, page - 1))}
				disabled={page === 1}
				class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ash-800 border border-ash-700 hover:bg-ash-700 text-ash-200 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
			>
				<i class="fas fa-chevron-left text-xs"></i>Previous
			</button>
			<span class="text-sm text-ash-400">Page {page} of {totalPages}</span>
			<button
				onclick={() => (page = Math.min(totalPages, page + 1))}
				disabled={page === totalPages}
				class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ash-800 border border-ash-700 hover:bg-ash-700 text-ash-200 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
			>
				Next<i class="fas fa-chevron-right text-xs"></i>
			</button>
		</div>
	{/if}
{/if}
