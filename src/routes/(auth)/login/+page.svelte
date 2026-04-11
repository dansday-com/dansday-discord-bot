<script lang="ts">
	import { goto } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let loading = $state(false);
	let showPassword = $state(false);
	let usernameOrEmail = $state('');
	let password = $state('');

	let showCaptchaModal = $state(false);
	let captchaInput = $state('');
	let captchaToken = $state('');
	let captchaSvg = $state('');
	let captchaLoading = $state(false);

	async function refreshDemoCaptcha() {
		await openDemoCaptcha();
	}

	async function openDemoCaptcha() {
		captchaInput = '';
		captchaToken = '';
		captchaSvg = '';
		captchaLoading = true;
		try {
			const res = await fetch('/api/panel/demo-login', { method: 'GET', credentials: 'include' });
			const data = await res.json();
			captchaToken = data.token ?? '';
			captchaSvg = data.image_svg ?? '';
			showCaptchaModal = true;
		} catch (_) {
			showToast('Failed to load captcha. Please try again.', 'error');
		} finally {
			captchaLoading = false;
		}
	}

	async function handleDemoLogin() {
		loading = true;
		showCaptchaModal = false;
		try {
			const res = await fetch('/api/panel/demo-login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ captcha_input: captchaInput, captcha_token: captchaToken })
			});
			const data = await res.json();
			if (data.success) {
				showToast('Logged in to demo (5 minutes)', 'success');
				setTimeout(() => goto('/dashboard'), 300);
			} else {
				showToast(data.error || 'Demo login failed', 'error');
			}
		} catch (_) {
			showToast('Demo login failed. Please try again.', 'error');
		} finally {
			loading = false;
			captchaInput = '';
			captchaToken = '';
			captchaSvg = '';
		}
	}

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
				setTimeout(() => goto('/dashboard'), 500);
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
	<title>Login | Dansday Discord Bot</title>
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

		<div class="flex items-center gap-3">
			<div class="bg-ash-700/70 h-px flex-1"></div>
			<div class="text-ash-500 text-[11px] font-semibold tracking-widest">OR</div>
			<div class="bg-ash-700/70 h-px flex-1"></div>
		</div>

		<button
			type="button"
			disabled={loading || captchaLoading}
			onclick={openDemoCaptcha}
			class="bg-ash-700 border-ash-600 text-ash-100 hover:bg-ash-650 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-50 sm:py-3 sm:text-base"
		>
			{#if captchaLoading}
				<i class="fas fa-spinner fa-spin text-cyan-300"></i>
			{:else}
				<i class="fas fa-flask text-cyan-300"></i>
			{/if}
			Login for demo
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

{#if showCaptchaModal}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
		onclick={(e) => {
			if (e.target === e.currentTarget) {
				showCaptchaModal = false;
				captchaInput = '';
			}
		}}
	>
		<div class="bg-ash-800 border-ash-700 w-full max-w-sm rounded-2xl border p-6 shadow-2xl">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-ash-100 text-lg font-bold">Verify you're human</h2>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={refreshDemoCaptcha}
						class="text-ash-400 hover:text-ash-200 rounded-lg px-2 py-1 transition-colors"
						aria-label="Refresh captcha"
						title="Refresh"
					>
						<i class="fas fa-rotate-right"></i>
					</button>
					<button
						type="button"
						onclick={() => {
							showCaptchaModal = false;
							captchaInput = '';
						}}
						class="text-ash-400 hover:text-ash-200 rounded-lg px-2 py-1 transition-colors"
						aria-label="Close"
					>
						<i class="fas fa-times"></i>
					</button>
				</div>
			</div>

			<p class="text-ash-400 mb-4 text-sm">Type the characters shown below exactly as displayed.</p>

			<div class="bg-ash-950 border-ash-700/80 ring-ash-600/60 mb-4 overflow-hidden rounded-xl border p-3 shadow-inner ring-1 ring-inset">
				<div class="flex items-center justify-center select-none" aria-hidden="true">
					<div class="w-full max-w-[360px] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full">{@html captchaSvg}</div>
				</div>
			</div>

			<input
				type="text"
				bind:value={captchaInput}
				placeholder="Enter characters above"
				maxlength="6"
				autocapitalize="none"
				autocomplete="off"
				autocorrect="off"
				spellcheck="false"
				class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 mb-4 w-full rounded-xl border px-4 py-3 text-center font-mono text-lg tracking-wider transition-all placeholder:tracking-normal focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-400/40 focus:outline-none"
				onkeydown={(e) => {
					if (e.key === 'Enter') handleDemoLogin();
				}}
			/>

			<div class="flex gap-3">
				<button
					type="button"
					onclick={() => {
						showCaptchaModal = false;
						captchaInput = '';
					}}
					class="bg-ash-700 border-ash-600 text-ash-200 hover:bg-ash-600 flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all"
				>
					Cancel
				</button>
				<button
					type="button"
					disabled={captchaInput.length !== 6}
					onclick={handleDemoLogin}
					class="flex-1 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition-all hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Continue
				</button>
			</div>
		</div>
	</div>
{/if}
