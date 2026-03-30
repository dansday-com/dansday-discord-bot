<script lang="ts">
	import { goto } from '$app/navigation';
	import { showToast } from '$lib/stores/toast.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let loading = $state(false);
	let showPassword = $state(false);
	let username = $state('');
	let email = $state('');
	let password = $state('');

	async function handleSubmit() {
		if (!username || username.length < 3) {
			showToast('Username must be at least 3 characters long', 'error');
			return;
		}
		if (!/^[a-zA-Z]+$/.test(username)) {
			showToast('Username can only contain letters', 'error');
			return;
		}
		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			showToast('Please enter a valid email address', 'error');
			return;
		}
		if (!password || password.length < 6) {
			showToast('Password must be at least 6 characters long', 'error');
			return;
		}

		loading = true;
		try {
			const endpoint = data.token ? '/api/panel/register-with-token' : '/api/panel/register';
			const body = data.token ? { token: data.token, username, email, password } : { username, email, password };

			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(body)
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({ error: 'Registration failed' }));
				showToast(err.error || 'Registration failed', 'error');
				return;
			}

			const d = await res.json();
			if (d.success) {
				showToast(d.message || 'Registration successful! Check your email for the verification code.', 'success');
				goto(`/verify?account_id=${d.account_id}`);
			} else {
				showToast(d.error || 'Registration failed', 'error');
			}
		} catch {
			showToast('Registration failed. Please try again.', 'error');
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Register | Dansday</title>
</svelte:head>

<div class="bg-ash-800 border-ash-700 rounded-2xl border p-6 shadow-2xl sm:p-8">
	<div class="mb-6 text-center sm:mb-8">
		<div class="bg-ash-400 mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full sm:mb-4 sm:h-16 sm:w-16">
			<i class="fas fa-bolt text-ash-100 text-xl sm:text-2xl"></i>
		</div>
		<h1 class="text-ash-100 mb-2 text-2xl font-bold sm:text-3xl">Dansday</h1>
		<p class="text-ash-400 text-xs sm:text-sm">Create an account</p>
	</div>

	<form
		onsubmit={(e) => {
			e.preventDefault();
			handleSubmit();
		}}
		class="space-y-4 sm:space-y-6"
	>
		<div>
			<label for="username" class="text-ash-300 mb-2 block text-xs font-medium sm:text-sm">
				<i class="fas fa-user mr-2"></i>Username <span class="text-ash-200">*</span>
			</label>
			<input
				id="username"
				type="text"
				bind:value={username}
				placeholder="Letters only"
				autocomplete="username"
				pattern="[a-zA-Z]+"
				class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:border-transparent focus:ring-2 focus:outline-none sm:px-4 sm:py-3 sm:text-base"
			/>
		</div>

		<div>
			<label for="email" class="text-ash-300 mb-2 block text-xs font-medium sm:text-sm">
				<i class="fas fa-envelope mr-2"></i>Email <span class="text-ash-200">*</span>
			</label>
			<input
				id="email"
				type="email"
				bind:value={email}
				placeholder="Enter your email"
				autocomplete="email"
				class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:border-transparent focus:ring-2 focus:outline-none sm:px-4 sm:py-3 sm:text-base"
			/>
		</div>

		<div>
			<label for="password" class="text-ash-300 mb-2 block text-xs font-medium sm:text-sm">
				<i class="fas fa-lock mr-2"></i>Password <span class="text-ash-200">*</span>
			</label>
			<div class="relative">
				<input
					id="password"
					type={showPassword ? 'text' : 'password'}
					bind:value={password}
					placeholder="Min. 6 characters"
					autocomplete="new-password"
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
			{#if loading}<i class="fas fa-spinner fa-spin"></i>{/if}
			{loading ? 'Processing...' : 'Register'}
		</button>

		<div class="text-center">
			<p class="text-ash-400 text-xs sm:text-sm">
				Already have an account?
				<a href="/login" class="text-ash-200 hover:text-ash-300 ml-1">Login</a>
			</p>
		</div>
	</form>
</div>
