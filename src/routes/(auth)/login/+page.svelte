<script lang="ts">
	import { goto } from '$app/navigation';
	import { showToast } from '$lib/stores/toast.svelte';

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
				goto(`/verify?account_id=${data.account_id}`);
			} else {
				showToast(data.error || 'Login failed', 'error');
			}
		} catch {
			showToast('Login failed. Please try again.', 'error');
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Login | Dansday</title>
</svelte:head>

<div class="bg-ash-800 rounded-2xl shadow-2xl border border-ash-700 p-6 sm:p-8">
	<div class="text-center mb-6 sm:mb-8">
				<div class="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-ash-400 rounded-full mb-3 sm:mb-4">
					<i class="fas fa-bolt text-xl sm:text-2xl text-ash-100"></i>
				</div>
				<h1 class="text-2xl sm:text-3xl font-bold text-ash-100 mb-2">Dansday</h1>
				<p class="text-ash-400 text-xs sm:text-sm">Discord Bot Panel</p>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4 sm:space-y-6">
				<div>
					<label for="username_or_email" class="block text-xs sm:text-sm font-medium text-ash-300 mb-2">
						<i class="fas fa-user mr-2"></i>Username or Email <span class="text-ash-200">*</span>
					</label>
					<input
						id="username_or_email"
						type="text"
						bind:value={usernameOrEmail}
						placeholder="Enter username or email"
						autocomplete="username"
						class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-ash-700 border border-ash-600 rounded-lg text-ash-100 placeholder-ash-500 focus:outline-none focus:ring-2 focus:ring-ash-500 focus:border-transparent transition-all text-sm sm:text-base"
					/>
				</div>

				<div>
					<label for="password" class="block text-xs sm:text-sm font-medium text-ash-300 mb-2">
						<i class="fas fa-lock mr-2"></i>Password <span class="text-ash-200">*</span>
					</label>
					<div class="relative">
						<input
							id="password"
							type={showPassword ? 'text' : 'password'}
							bind:value={password}
							placeholder="Enter your password"
							autocomplete="current-password"
							class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-ash-700 border border-ash-600 rounded-lg text-ash-100 placeholder-ash-500 focus:outline-none focus:ring-2 focus:ring-ash-500 focus:border-transparent transition-all text-sm sm:text-base pr-10"
						/>
						<button
							type="button"
							aria-label={showPassword ? 'Hide password' : 'Show password'}
							onclick={() => (showPassword = !showPassword)}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-ash-400 hover:text-ash-300 transition-colors"
						>
							<i class="fas {showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm sm:text-base"></i>
						</button>
					</div>
				</div>

				<button
					type="submit"
					disabled={loading}
					class="w-full bg-ash-400 hover:bg-ash-500 text-ash-100 font-semibold py-2.5 sm:py-3 px-4 rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm sm:text-base"
				>
					{#if loading}<i class="fas fa-spinner fa-spin"></i>{/if}
					{loading ? 'Processing...' : 'Login'}
				</button>

				<div class="text-center">
					<p class="text-xs sm:text-sm text-ash-400">
						Don't have an account?
						<a href="/register" class="text-ash-200 hover:text-ash-300 ml-1">Register</a>
					</p>
				</div>
	</form>
</div>
