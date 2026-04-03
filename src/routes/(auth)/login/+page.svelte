<script lang="ts">
	import { goto } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let loading = $state(false);
	let showPassword = $state(false);
	let usernameOrEmail = $state('');
	let password = $state('');

	async function handleSubmit() {
		if (!usernameOrEmail || !password) {
			showToast('Username/Email and password are required', 'error');
			return;
		}

		loading = true;
		try {
			const res = await fetch('/api/panel/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ username_or_email: usernameOrEmail, password })
			});
			const data = await res.json();

			if (data.success) {
				showToast(data.message || 'Login successful!', 'success');
				setTimeout(() => goto('/'), 500);
			} else if (data.requires_verification) {
				showToast('Please verify your email first. Redirecting...', 'error');
				const source = data.account_source === 'server_accounts' ? '&source=server_accounts' : '';
				setTimeout(() => goto(`/verify?token=${data.verify_token}${source}`), 1000);
			} else {
				showToast(data.error || 'Login failed', 'error');
			}
		} catch (_) {
			showToast('Login failed. Please try again.', 'error');
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Login | Dansday</title>
</svelte:head>

<div class="bg-ash-800 border-ash-700 rounded-2xl border p-6 shadow-2xl sm:p-8">
	<div class="mb-6 text-center sm:mb-8">
		<div class="bg-ash-400 mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full sm:mb-4 sm:h-16 sm:w-16">
			<i class="fas fa-bolt text-xl text-amber-300 sm:text-2xl"></i>
		</div>
		<h1 class="text-ash-100 mb-2 text-2xl font-bold sm:text-3xl">Dansday</h1>
		<p class="text-ash-400 text-xs sm:text-sm">Discord Bot Panel</p>
	</div>

	<form
		onsubmit={(e) => {
			e.preventDefault();
			handleSubmit();
		}}
		class="space-y-4 sm:space-y-6"
	>
		<div>
			<label for="username_or_email" class="text-ash-300 mb-2 block text-xs font-medium sm:text-sm">
				<i class="fas fa-user mr-2 text-cyan-300"></i>Username or Email <span class="text-ash-200">*</span>
			</label>
			<input
				id="username_or_email"
				type="text"
				bind:value={usernameOrEmail}
				placeholder="Enter username or email"
				autocomplete="username"
				class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:border-transparent focus:ring-2 focus:outline-none sm:px-4 sm:py-3 sm:text-base"
			/>
		</div>

		<div>
			<label for="password" class="text-ash-300 mb-2 block text-xs font-medium sm:text-sm">
				<i class="fas fa-lock mr-2 text-rose-300"></i>Password <span class="text-ash-200">*</span>
			</label>
			<div class="relative">
				<input
					id="password"
					type={showPassword ? 'text' : 'password'}
					bind:value={password}
					placeholder="Enter your password"
					autocomplete="current-password"
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 pr-10 text-sm transition-all focus:border-transparent focus:ring-2 focus:outline-none sm:px-4 sm:py-3 sm:text-base"
				/>
				<button
					type="button"
					aria-label={showPassword ? 'Hide password' : 'Show password'}
					onclick={() => (showPassword = !showPassword)}
					class="text-ash-400 hover:text-ash-300 absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
				>
					<i class="fas {showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm sm:text-base"></i>
				</button>
			</div>
		</div>

		<button
			type="submit"
			disabled={loading}
			class="bg-ash-400 hover:bg-ash-500 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-50 sm:py-3 sm:text-base"
		>
			{#if loading}<i class="fas fa-spinner fa-spin text-amber-200"></i>{/if}
			{loading ? 'Processing...' : 'Login'}
		</button>

		{#if data.canRegister}
			<div class="text-center">
				<p class="text-ash-400 text-xs sm:text-sm">
					Don't have an account?
					<a href="/register" class="text-ash-200 hover:text-ash-300 ml-1">Register</a>
				</p>
			</div>
		{/if}
	</form>
</div>
