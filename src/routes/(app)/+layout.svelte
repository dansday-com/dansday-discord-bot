<script lang="ts">
	import { goto } from '$app/navigation';
	import { showToast } from '$lib/stores/toast.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	async function handleLogout() {
		await fetch('/api/panel/logout', { method: 'POST', credentials: 'include' });
		goto('/login');
	}
</script>

<div class="min-h-screen flex flex-col bg-ash-950 text-ash-100">
	<header class="bg-ash-800 border-b border-ash-700 sticky top-0 z-40 flex-shrink-0">
		<div class="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
			<div class="flex items-center justify-between h-14 sm:h-16 py-2">
				<a href="/" class="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
					<div class="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-ash-400 rounded-full flex-shrink-0">
						<i class="fas fa-bolt text-ash-100 text-sm sm:text-base"></i>
					</div>
					<h1 class="text-base sm:text-xl font-bold text-ash-100 truncate">Dansday Discord Bot Panel</h1>
				</a>
				<div class="flex items-center gap-2 flex-shrink-0">
					{#if data.user.account_type === 'admin'}
						<a
							href="/accounts"
							class="bg-ash-600 hover:bg-ash-700 text-ash-100 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
						>
							<i class="fas fa-users text-xs sm:text-sm"></i>
							<span class="sm:inline">Accounts</span>
						</a>
					{/if}
					<button
						onclick={handleLogout}
						class="bg-ash-700 hover:bg-ash-600 text-ash-100 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
					>
						<i class="fas fa-sign-out-alt text-xs sm:text-sm"></i>
						<span class="hidden sm:inline">Logout</span>
					</button>
				</div>
			</div>
		</div>
	</header>

	<main class="flex-1 overflow-y-auto">
		{@render children()}
	</main>

	<footer class="bg-ash-800 border-t border-ash-700 flex-shrink-0">
		<div class="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
			<p class="text-center text-ash-500 text-xs sm:text-sm">
				Copyright &copy; {new Date().getFullYear()}
				<a href="https://dansday.com" target="_blank" class="text-ash-200 hover:text-ash-300 transition-colors">dansday.com</a>. All rights reserved.
			</p>
		</div>
	</footer>
</div>
