import { DEFAULT_SERVER_LANGUAGE, normalizeServerLanguage, type ServerLanguage } from './languages.js';

export type GreetingKind = 'welcomer' | 'booster';

export const DEFAULT_GREETING_MESSAGES: Record<GreetingKind, Record<ServerLanguage, string[]>> = {
	welcomer: {
		en: [
			'👋 Welcome {user} to {server}! You are member #{memberCount} (Account age: {accountAge}).',
			'🎉 {user} joined {server}! Member #{memberCount} | Account age: {accountAge}.',
			"🌟 Welcome {user}! You're now part of {server} (Member #{memberCount}, Account age: {accountAge}).",
			'🚀 {user} just joined {server}! Member #{memberCount} | Account age: {accountAge}.',
			"🎊 Hello {user}! Welcome to {server}! You're member #{memberCount} (Account age: {accountAge})."
		],
		id: [
			'👋 Selamat datang {user} di {server}! Kamu adalah anggota ke-{memberCount} (Usia akun: {accountAge}).',
			'🎉 {user} bergabung ke {server}! Anggota ke-{memberCount} | Usia akun: {accountAge}.',
			'🌟 Selamat datang {user}! Sekarang kamu bagian dari {server} (Anggota ke-{memberCount}, Usia akun: {accountAge}).',
			'🚀 {user} baru saja bergabung ke {server}! Anggota ke-{memberCount} | Usia akun: {accountAge}.',
			'🎊 Halo {user}! Selamat datang di {server}! Kamu anggota ke-{memberCount} (Usia akun: {accountAge}).'
		],
		de: [
			'👋 Willkommen {user} auf {server}! Du bist Mitglied #{memberCount} (Kontoalter: {accountAge}).',
			'🎉 {user} ist {server} beigetreten! Mitglied #{memberCount} | Kontoalter: {accountAge}.',
			'🌟 Willkommen {user}! Du bist jetzt Teil von {server} (Mitglied #{memberCount}, Kontoalter: {accountAge}).',
			'🚀 {user} ist gerade {server} beigetreten! Mitglied #{memberCount} | Kontoalter: {accountAge}.',
			'🎊 Hallo {user}! Willkommen auf {server}! Du bist Mitglied #{memberCount} (Kontoalter: {accountAge}).'
		],
		es: [
			'👋 ¡Bienvenido {user} a {server}! Eres el miembro #{memberCount} (Antigüedad de la cuenta: {accountAge}).',
			'🎉 ¡{user} se unió a {server}! Miembro #{memberCount} | Antigüedad de la cuenta: {accountAge}.',
			'🌟 ¡Bienvenido {user}! Ahora eres parte de {server} (Miembro #{memberCount}, Antigüedad de la cuenta: {accountAge}).',
			'🚀 ¡{user} acaba de unirse a {server}! Miembro #{memberCount} | Antigüedad de la cuenta: {accountAge}.',
			'🎊 ¡Hola {user}! ¡Bienvenido a {server}! Eres el miembro #{memberCount} (Antigüedad de la cuenta: {accountAge}).'
		],
		fr: [
			'👋 Bienvenue {user} sur {server} ! Tu es le membre n°{memberCount} (Âge du compte : {accountAge}).',
			'🎉 {user} a rejoint {server} ! Membre n°{memberCount} | Âge du compte : {accountAge}.',
			'🌟 Bienvenue {user} ! Tu fais maintenant partie de {server} (Membre n°{memberCount}, Âge du compte : {accountAge}).',
			'🚀 {user} vient de rejoindre {server} ! Membre n°{memberCount} | Âge du compte : {accountAge}.',
			'🎊 Salut {user} ! Bienvenue sur {server} ! Tu es le membre n°{memberCount} (Âge du compte : {accountAge}).'
		],
		ar: [
			'👋 أهلاً بك {user} في {server}! أنت العضو رقم {memberCount} (عمر الحساب: {accountAge}).',
			'🎉 انضم {user} إلى {server}! العضو رقم {memberCount} | عمر الحساب: {accountAge}.',
			'🌟 مرحباً {user}! أصبحت الآن جزءاً من {server} (العضو رقم {memberCount}، عمر الحساب: {accountAge}).',
			'🚀 انضم {user} للتو إلى {server}! العضو رقم {memberCount} | عمر الحساب: {accountAge}.',
			'🎊 أهلاً {user}! مرحباً بك في {server}! أنت العضو رقم {memberCount} (عمر الحساب: {accountAge}).'
		],
		ms: [
			'👋 Selamat datang {user} ke {server}! Anda ahli ke-{memberCount} (Umur akaun: {accountAge}).',
			'🎉 {user} telah menyertai {server}! Ahli ke-{memberCount} | Umur akaun: {accountAge}.',
			'🌟 Selamat datang {user}! Anda kini sebahagian daripada {server} (Ahli ke-{memberCount}, Umur akaun: {accountAge}).',
			'🚀 {user} baru sahaja menyertai {server}! Ahli ke-{memberCount} | Umur akaun: {accountAge}.',
			'🎊 Hai {user}! Selamat datang ke {server}! Anda ahli ke-{memberCount} (Umur akaun: {accountAge}).'
		],
		zh: [
			'👋 欢迎 {user} 加入 {server}！你是第 {memberCount} 位成员（账号年龄：{accountAge}）。',
			'🎉 {user} 加入了 {server}！第 {memberCount} 位成员 | 账号年龄：{accountAge}。',
			'🌟 欢迎 {user}！你现在是 {server} 的一员了（第 {memberCount} 位成员，账号年龄：{accountAge}）。',
			'🚀 {user} 刚刚加入了 {server}！第 {memberCount} 位成员 | 账号年龄：{accountAge}。',
			'🎊 你好 {user}！欢迎来到 {server}！你是第 {memberCount} 位成员（账号年龄：{accountAge}）。'
		]
	},
	booster: {
		en: [
			'🎉 {user} just boosted {server}! Current level: {boostLevel} | Total boosts: {totalBoosts}.',
			"💎 Thanks {user} for boosting {server}! We're now Level {boostLevel} with {totalBoosts} boosts.",
			'🚀 {user} boosted {server}! Server Level: {boostLevel} | Boosts: {totalBoosts}.',
			'🔥 Huge thanks to {user} for boosting {server}! Total boosts: {totalBoosts} (Level {boostLevel}).',
			'⭐ {user} just gave {server} a boost! Level {boostLevel} with {totalBoosts} boosts.'
		],
		id: [
			'🎉 {user} baru saja mem-boost {server}! Level saat ini: {boostLevel} | Total boost: {totalBoosts}.',
			'💎 Terima kasih {user} sudah mem-boost {server}! Sekarang kita Level {boostLevel} dengan {totalBoosts} boost.',
			'🚀 {user} mem-boost {server}! Level server: {boostLevel} | Boost: {totalBoosts}.',
			'🔥 Terima kasih banyak {user} sudah mem-boost {server}! Total boost: {totalBoosts} (Level {boostLevel}).',
			'⭐ {user} baru saja memberi boost untuk {server}! Level {boostLevel} dengan {totalBoosts} boost.'
		],
		de: [
			'🎉 {user} hat {server} gerade geboostet! Aktuelles Level: {boostLevel} | Boosts insgesamt: {totalBoosts}.',
			'💎 Danke {user} fürs Boosten von {server}! Wir sind jetzt Level {boostLevel} mit {totalBoosts} Boosts.',
			'🚀 {user} hat {server} geboostet! Server-Level: {boostLevel} | Boosts: {totalBoosts}.',
			'🔥 Riesigen Dank an {user} fürs Boosten von {server}! Boosts insgesamt: {totalBoosts} (Level {boostLevel}).',
			'⭐ {user} hat {server} gerade einen Boost geschenkt! Level {boostLevel} mit {totalBoosts} Boosts.'
		],
		es: [
			'🎉 ¡{user} acaba de mejorar {server}! Nivel actual: {boostLevel} | Mejoras totales: {totalBoosts}.',
			'💎 ¡Gracias {user} por mejorar {server}! Ahora somos Nivel {boostLevel} con {totalBoosts} mejoras.',
			'🚀 ¡{user} mejoró {server}! Nivel del servidor: {boostLevel} | Mejoras: {totalBoosts}.',
			'🔥 ¡Muchísimas gracias a {user} por mejorar {server}! Mejoras totales: {totalBoosts} (Nivel {boostLevel}).',
			'⭐ ¡{user} acaba de darle una mejora a {server}! Nivel {boostLevel} con {totalBoosts} mejoras.'
		],
		fr: [
			'🎉 {user} vient de booster {server} ! Niveau actuel : {boostLevel} | Boosts au total : {totalBoosts}.',
			"💎 Merci {user} d'avoir boosté {server} ! On est maintenant niveau {boostLevel} avec {totalBoosts} boosts.",
			'🚀 {user} a boosté {server} ! Niveau du serveur : {boostLevel} | Boosts : {totalBoosts}.',
			'🔥 Un énorme merci à {user} pour le boost de {server} ! Boosts au total : {totalBoosts} (niveau {boostLevel}).',
			"⭐ {user} vient d'offrir un boost à {server} ! Niveau {boostLevel} avec {totalBoosts} boosts."
		],
		ar: [
			'🎉 قام {user} للتو بتعزيز {server}! المستوى الحالي: {boostLevel} | إجمالي التعزيزات: {totalBoosts}.',
			'💎 شكراً {user} على تعزيز {server}! أصبحنا الآن في المستوى {boostLevel} مع {totalBoosts} تعزيزات.',
			'🚀 قام {user} بتعزيز {server}! مستوى الخادم: {boostLevel} | التعزيزات: {totalBoosts}.',
			'🔥 شكراً جزيلاً لـ {user} على تعزيز {server}! إجمالي التعزيزات: {totalBoosts} (المستوى {boostLevel}).',
			'⭐ منح {user} للتو تعزيزاً لـ {server}! المستوى {boostLevel} مع {totalBoosts} تعزيزات.'
		],
		ms: [
			'🎉 {user} baru sahaja boost {server}! Tahap semasa: {boostLevel} | Jumlah boost: {totalBoosts}.',
			'💎 Terima kasih {user} kerana boost {server}! Kita kini Tahap {boostLevel} dengan {totalBoosts} boost.',
			'🚀 {user} telah boost {server}! Tahap server: {boostLevel} | Boost: {totalBoosts}.',
			'🔥 Terima kasih banyak-banyak kepada {user} kerana boost {server}! Jumlah boost: {totalBoosts} (Tahap {boostLevel}).',
			'⭐ {user} baru sahaja memberi boost kepada {server}! Tahap {boostLevel} dengan {totalBoosts} boost.'
		],
		zh: [
			'🎉 {user} 刚刚助力了 {server}！当前等级：{boostLevel} | 助力总数：{totalBoosts}。',
			'💎 感谢 {user} 助力 {server}！我们现在是 {boostLevel} 级，共有 {totalBoosts} 次助力。',
			'🚀 {user} 助力了 {server}！服务器等级：{boostLevel} | 助力数：{totalBoosts}。',
			'🔥 非常感谢 {user} 助力 {server}！助力总数：{totalBoosts}（{boostLevel} 级）。',
			'⭐ {user} 刚刚为 {server} 送上一次助力！{boostLevel} 级，共 {totalBoosts} 次助力。'
		]
	}
};

const ALL_DEFAULTS: Record<GreetingKind, Set<string>> = {
	welcomer: new Set(Object.values(DEFAULT_GREETING_MESSAGES.welcomer).flat()),
	booster: new Set(Object.values(DEFAULT_GREETING_MESSAGES.booster).flat())
};

export function defaultGreetingMessages(kind: GreetingKind, lang: unknown = DEFAULT_SERVER_LANGUAGE): string[] {
	return DEFAULT_GREETING_MESSAGES[kind][normalizeServerLanguage(lang)];
}

export function isDefaultGreetingSet(kind: GreetingKind, messages: unknown): boolean {
	if (!Array.isArray(messages) || messages.length === 0) return true;
	return messages.every((m) => typeof m === 'string' && ALL_DEFAULTS[kind].has(m));
}

export function greetingMessagesFor(kind: GreetingKind, messages: unknown, lang: unknown): string[] {
	return isDefaultGreetingSet(kind, messages) ? defaultGreetingMessages(kind, lang) : (messages as string[]);
}
