# Security Policy

## Reporting a vulnerability

Email **security@dansday.com**. Do not open a public issue, pull request or Discord message for a security problem.

Please include:

- What the issue is and where in the code or panel it lives.
- Steps to reproduce, or a short proof of concept.
- What an attacker gains — data read, privileges gained, service taken down.
- Whether you tested the hosted bot or a self-hosted install, and which version.

You will get a first reply within 72 hours. Valid reports get a fix timeline in that reply, and credit in the release notes unless you ask otherwise.

## Scope

In scope:

- This repository — the web panel, the bots, the API routes and the database layer.
- The hosted bot and panel at dansday.com.

Out of scope:

- Anything needing a Discord token, panel session or API key that you already own.
- Self-hosted installs misconfigured against the guidance below.
- Findings from an automated scanner with no working exploit, including dependency alerts already listed in this repository's Dependabot page.
- Discord, Roblox, CoinGecko, or any AI provider — report those to the vendor.
- Rate limits, missing headers or version disclosure with no demonstrated impact.

## Testing rules

Test only against your own self-hosted install or your own server on the hosted bot. Do not touch other people's servers, accounts or data, and do not run denial-of-service or automated scans against dansday.com.

## Supported versions

Fixes ship on the latest release only. There are no long-term support branches — update to the newest tag before reporting.

## Self-hosting

You own the security of your own deployment:

- Keep `.env` out of version control. It holds your database credentials, mail credentials, `CAPTCHA_SECRET` and `COINGECKO_API_KEY`.
- Put the panel behind HTTPS. The session cookie is `HttpOnly` and `SameSite=Lax` but carries no `Secure` flag, so over plain HTTP both the session and the login credentials travel in the clear.
- Do not expose the MySQL or Redis port to the internet.
- Give the panel its own database user, not root.
- Run `npm audit` after pulling and update dependencies.
- Bot tokens, AI provider keys and self-bot tokens are stored in the database, not `.env`. Treat the database as credential storage and restrict access accordingly — a self-bot token lets the holder act as that Discord user.
- The AI provider endpoints, proxies and wiki URLs you configure are fetched by the server. Only point them at hosts you trust.
