<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { goto } from '$app/navigation';
	import { DASHBOARD_PATH } from '$lib/frontend/redirect.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let loading = $state(false);
	let otpCode = $state('');

	async function handleSubmit() {
		if (!otpCode || otpCode.length !== 6) {
			showToast('Please enter a valid 6-digit code', 'error');
			return;
		}

		loading = true;
		try {
			const res = await fetch('/api/panel/verify-otp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ verify_token: data.verifyToken, otp_code: otpCode, account_source: data.accountSource })
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({ error: 'Verification failed' }));
				showToast(err.error || 'OTP verification failed', 'error');
				return;
			}

			const d = await res.json();
			if (d.success) {
				showToast(d.message || 'Email verified successfully!', 'success');
				setTimeout(() => goto(DASHBOARD_PATH), 1000);
			} else {
				showToast(d.error || 'OTP verification failed', 'error');
			}
		} catch (_) {
			showToast('Verification failed. Please try again.', 'error');
		} finally {
			loading = false;
		}
	}

	async function resendOtp() {
		try {
			const res = await fetch('/api/panel/resend-otp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ verify_token: data.verifyToken, account_source: data.accountSource })
			});
			const d = await res.json().catch(() => ({}));
			showToast(d.message || d.error || 'Code resent', d.success ? 'success' : 'error');
		} catch (_) {
			showToast('Failed to resend code', 'error');
		}
	}
</script>

<svelte:head>
	<title>Verify Email | {APP_NAME} Discord Bot</title>
</svelte:head>

<div class="bg-ash-800 border-ash-700 rounded-2xl border p-6 shadow-2xl sm:p-8">
	<div class="mb-6 text-center sm:mb-8">
		<div class="bg-ash-400 mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full sm:mb-4 sm:h-16 sm:w-16">
			<i class="fas fa-envelope-open-text text-xl text-sky-300 sm:text-2xl"></i>
		</div>
		<h1 class="text-ash-100 mb-2 text-2xl font-bold sm:text-3xl">Verify Email</h1>
		<p class="text-ash-400 text-xs sm:text-sm">Enter the 6-digit code sent to your email</p>
	</div>

	<form
		onsubmit={(e) => {
			e.preventDefault();
			handleSubmit();
		}}
		class="space-y-4 sm:space-y-6"
	>
		<div>
			<label for="otp_code" class="text-ash-300 mb-2 block text-xs font-medium sm:text-sm">
				<i class="fas fa-key mr-2 text-amber-300"></i>Verification Code <span class="text-ash-200">*</span>
			</label>
			<input
				id="otp_code"
				type="text"
				bind:value={otpCode}
				maxlength="6"
				placeholder="000000"
				autocomplete="one-time-code"
				oninput={(e) => {
					const t = e.currentTarget as HTMLInputElement;
					t.value = t.value.replace(/[^0-9]/g, '');
					otpCode = t.value;
				}}
				class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-center text-2xl tracking-widest transition-all focus:border-transparent focus:ring-2 focus:outline-none sm:px-4 sm:py-3"
			/>
			<p class="text-ash-400 mt-2 text-center text-xs">
				<button type="button" onclick={resendOtp} class="text-ash-200 hover:text-ash-300 underline"> Resend code </button>
			</p>
		</div>

		<button
			type="submit"
			disabled={loading}
			class="bg-ash-400 hover:bg-ash-500 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:transform-none disabled:cursor-not-allowed disabled:opacity-50 sm:py-3 sm:text-base"
		>
			{#if loading}<i class="fas fa-spinner fa-spin text-amber-200"></i>{/if}
			{loading ? 'Verifying...' : 'Verify'}
		</button>

		<div class="text-center">
			<a href="/login" class="text-ash-400 hover:text-ash-300 text-xs sm:text-sm"> &larr; Back to login </a>
		</div>
	</form>
</div>
