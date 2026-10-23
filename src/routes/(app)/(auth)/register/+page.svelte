<script lang="ts">
	import { ACCOUNT_ROLE_LABELS, USERNAME_MIN_LENGTH } from '$lib/accounts.js';
	import { APP_NAME } from '$lib/backend/panelServer.js';
	import { goto, invalidateAll } from '$app/navigation';
	import { DASHBOARD_PATH } from '$lib/frontend/redirect.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import type { PageProps } from './$types';

	const PASSWORD_MIN_LENGTH = 6;
	const ERROR_REDIRECT_DELAY_MS = 1500;
	const SUCCESS_REDIRECT_DELAY_MS = 500;
	const INPUT_CLASS =
		'bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:border-transparent focus:ring-2 focus:outline-none sm:px-4 sm:py-3 sm:text-base';
	const SUBMIT_CLASS =
		'bg-ash-400 hover:bg-ash-500 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-50 sm:py-3 sm:text-base';

	let { data }: PageProps = $props();

	let isLoading = $state(false);
	let isPasswordShown = $state(false);
	let username = $state('');
	let email = $state('');
	let password = $state('');

	const roleLabel = $derived(data.invite ? ACCOUNT_ROLE_LABELS[data.invite.account_type] : '');
	const loginHref = $derived(data.token ? `/login?invite=${encodeURIComponent(data.token)}` : '/login');

	function createFormProblem(): string | null {
		if (!username || username.length < USERNAME_MIN_LENGTH) {
			return `Username must be at least ${USERNAME_MIN_LENGTH} characters long`;
		}
		if (!/^[a-zA-Z]+$/.test(username)) {
			return 'Username can only contain letters';
		}
		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return 'Please enter a valid email address';
		}
		if (!password || password.length < PASSWORD_MIN_LENGTH) {
			return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`;
		}
		return null;
	}

	async function postJson(endpoint: string, body: Record<string, unknown>) {
		const res = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(body)
		});
		return res.json().catch(() => ({ success: false, error: 'Something went wrong. Please try again.' }));
	}

	async function handleCreate() {
		const problem = createFormProblem();
		if (problem) {
			showToast(problem, 'error');
			return;
		}
		isLoading = true;
		try {
			const endpoint = data.token ? '/api/panel/register-with-token' : '/api/panel/register';
			const body = data.token ? { token: data.token, username, email, password } : { username, email, password };
			const result = await postJson(endpoint, body);
			if (result.success) {
				showToast(result.message || 'Registration successful!', 'success');
				setTimeout(() => goto(DASHBOARD_PATH), SUCCESS_REDIRECT_DELAY_MS);
				return;
			}
			showToast(result.error || 'Registration failed', 'error');
			if (result.redirect_to) {
				setTimeout(() => goto(result.redirect_to), ERROR_REDIRECT_DELAY_MS);
			}
		} catch (_) {
			showToast('Registration failed. Please try again.', 'error');
		} finally {
			isLoading = false;
		}
	}

	async function handleAccept() {
		isLoading = true;
		try {
			const result = await postJson('/api/panel/accept-invite', { token: data.token });
			if (result.success) {
				showToast(`You joined ${data.invite?.server_name} as ${roleLabel}`, 'success');
				setTimeout(() => goto(DASHBOARD_PATH, { invalidateAll: true }), SUCCESS_REDIRECT_DELAY_MS);
				return;
			}
			showToast(result.error || 'Could not accept the invite. Please try again.', 'error');
		} catch (_) {
			showToast('Could not accept the invite. Please try again.', 'error');
		} finally {
			isLoading = false;
		}
	}
	async function useAnotherAccount() {
		await fetch('/api/panel/logout', { method: 'POST', credentials: 'include' });
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>{data.invite ? `Join ${data.invite.server_name}` : 'Register'} | {APP_NAME} Discord Bot</title>
</svelte:head>

<div class="bg-ash-800 border-ash-700 rounded-2xl border p-6 shadow-2xl sm:p-8">
	<div class="mb-6 text-center sm:mb-8">
		<div class="bg-ash-400 mb-3 inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-full sm:mb-4 sm:h-16 sm:w-16">
			{#if data.invite?.server_icon}
				<img src={data.invite.server_icon} alt="" class="h-full w-full object-cover" />
			{:else}
				<i class="fas fa-bolt text-xl text-amber-300 sm:text-2xl"></i>
			{/if}
		</div>
		{#if data.invite}
			<h1 class="text-ash-100 mb-2 text-2xl font-bold wrap-break-word sm:text-3xl">Join {data.invite.server_name}</h1>
			<p class="text-ash-400 text-xs sm:text-sm">You were invited as {roleLabel}</p>
		{:else}
			<h1 class="text-ash-100 mb-2 text-2xl font-bold sm:text-3xl">{APP_NAME}</h1>
			<p class="text-ash-400 text-xs sm:text-sm">Create an account</p>
		{/if}
	</div>

	{#if data.inviteError}
		<div class="space-y-4 text-center">
			<p class="text-ash-300 text-sm">{data.inviteError}</p>
			<a href={DASHBOARD_PATH} class={SUBMIT_CLASS}>Go to your servers</a>
		</div>
	{:else if data.invite && data.signedInAs}
		<div class="space-y-4">
			<p class="text-ash-300 text-center text-sm">Logged in as <span class="text-ash-100 font-semibold">{data.signedInAs}</span></p>
			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleAccept();
				}}
			>
				<button type="submit" disabled={isLoading} class={SUBMIT_CLASS}>
					{#if isLoading}<i class="fas fa-spinner fa-spin text-amber-200"></i>{/if}
					Accept as {roleLabel}
				</button>
			</form>
			<button type="button" onclick={useAnotherAccount} disabled={isLoading} class="text-ash-400 hover:text-ash-200 w-full text-center text-xs sm:text-sm">
				Use another account
			</button>
		</div>
	{:else}
		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleCreate();
			}}
			class="space-y-4 sm:space-y-6"
		>
			<div>
				<label for="username" class="text-ash-300 mb-2 block text-xs font-medium sm:text-sm">
					<i class="fas fa-user mr-2 text-cyan-300"></i>Username <span class="text-ash-200">*</span>
				</label>
				<input id="username" type="text" bind:value={username} placeholder="Letters only" autocomplete="username" pattern="[a-zA-Z]+" class={INPUT_CLASS} />
			</div>

			<div>
				<label for="email" class="text-ash-300 mb-2 block text-xs font-medium sm:text-sm">
					<i class="fas fa-envelope mr-2 text-sky-300"></i>Email <span class="text-ash-200">*</span>
				</label>
				<input id="email" type="email" bind:value={email} placeholder="Enter your email" autocomplete="email" class={INPUT_CLASS} />
			</div>

			<div>
				<label for="password" class="text-ash-300 mb-2 block text-xs font-medium sm:text-sm">
					<i class="fas fa-lock mr-2 text-rose-300"></i>Password <span class="text-ash-200">*</span>
				</label>
				<div class="relative">
					<input
						id="password"
						type={isPasswordShown ? 'text' : 'password'}
						bind:value={password}
						placeholder="Min. 6 characters"
						autocomplete="new-password"
						class="{INPUT_CLASS} pr-10"
					/>
					<button
						type="button"
						aria-label={isPasswordShown ? 'Hide password' : 'Show password'}
						onclick={() => (isPasswordShown = !isPasswordShown)}
						class="text-ash-400 hover:text-ash-300 absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
					>
						<i class="fas {isPasswordShown ? 'fa-eye-slash' : 'fa-eye'} text-sm sm:text-base"></i>
					</button>
				</div>
			</div>

			<button type="submit" disabled={isLoading} class={SUBMIT_CLASS}>
				{#if isLoading}<i class="fas fa-spinner fa-spin text-amber-200"></i>{/if}
				{isLoading ? 'Processing...' : data.invite ? `Create account and join as ${roleLabel}` : 'Register'}
			</button>

			<div class="text-center">
				<p class="text-ash-400 text-xs sm:text-sm">
					Already have an account?
					<a href={loginHref} class="text-ash-200 hover:text-ash-300 ml-1">{data.invite ? 'Log in to accept' : 'Login'}</a>
				</p>
			</div>
		</form>
	{/if}
</div>
