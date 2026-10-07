const group = (id: string, label: string, icon: string, items: string) => ({
	id,
	label,
	icon,
	items: items.split('|').map((entry) => {
		const [emoji, ...name] = entry.split(' ');
		return { emoji, name: name.join(' ') };
	})
});

export const EMOJI_GROUPS = [
	group(
		'smileys',
		'Smileys',
		'😀',
		'😀 grinning happy|😃 smiley happy|😄 smile happy|😁 beaming grin|😆 laughing|😅 sweat smile relief|🤣 rofl laugh|😂 joy tears laugh|🙂 slight smile|😉 wink|😊 blush smile|😇 angel halo|🥰 loved hearts|😍 heart eyes love|🤩 star struck wow|😘 kiss|😋 yum tasty|😜 wink tongue|🤪 zany crazy|🤗 hug|🤔 thinking hmm|🤫 shush quiet|😐 neutral|😴 sleeping zzz|😎 cool sunglasses|🤓 nerd|🥳 party celebrate|😢 cry sad|😭 sob crying|😡 angry mad|🤯 mind blown|😱 scream shock|🥶 cold freezing|🥵 hot|🤖 robot bot|👻 ghost|💀 skull dead|👽 alien|🤡 clown|💩 poop'
	),
	group(
		'people',
		'People',
		'👋',
		'👋 wave hello welcome|👍 thumbs up yes like|👎 thumbs down no dislike|👏 clap applause|🙌 raised hands hooray|🙏 pray thanks please|🤝 handshake deal|💪 strong muscle|✌️ peace victory|🤞 fingers crossed luck|👌 ok perfect|👉 point right|👈 point left|👆 point up|👇 point down|✋ stop hand|🫡 salute|👀 eyes look|🧠 brain smart|👑 crown king owner|👮 police moderator|🕵️ detective spy|🧙 wizard mage|🥷 ninja|🧑 person member|👥 members people group|🗣️ speaking talk|💃 dance|🕺 dance'
	),
	group(
		'symbols',
		'Symbols',
		'❤️',
		'❤️ red heart love|🧡 orange heart|💛 yellow heart|💚 green heart|💙 blue heart|💜 purple heart|🖤 black heart|🤍 white heart|💔 broken heart|✅ check yes done|❌ cross no wrong|❗ exclamation important rules|❓ question help|⚠️ warning caution|🚫 forbidden banned|⛔ no entry stop|ℹ️ info information|🔔 bell notification ping|🔕 mute no bell|📢 announcement loudspeaker|📣 megaphone announce|💬 speech chat message|💯 hundred perfect|➕ plus add|➖ minus remove|♻️ recycle|🔄 refresh reload|⬆️ up arrow|⬇️ down arrow|➡️ right arrow next|⬅️ left arrow back|🔗 link url|🔒 lock locked private|🔓 unlock open|🔑 key access|🆕 new|🆓 free|🆙 up level|🔴 red circle|🟠 orange circle|🟡 yellow circle|🟢 green circle online|🔵 blue circle|🟣 purple circle|⚫ black circle|⚪ white circle'
	),
	group(
		'objects',
		'Objects',
		'⭐',
		'⭐ star favorite|🌟 glowing star|✨ sparkles new shiny|🔥 fire hot lit|💎 gem diamond premium|🎉 party popper celebrate|🎊 confetti|🎁 gift present giveaway|🏆 trophy winner|🥇 gold medal first|🥈 silver medal second|🥉 bronze medal third|🎮 game controller gaming|🕹️ joystick arcade|🎲 dice game|🎯 target goal|🎵 music note|🎶 music notes|🎧 headphones|🎤 microphone voice|🎬 clapper movie video|📷 camera photo|📹 video camera|📺 tv stream|💻 laptop computer|🖥️ desktop computer|📱 phone mobile|⌨️ keyboard|💡 idea bulb suggestion|🔧 wrench fix|🔨 hammer build moderation|⚙️ gear settings|🛠️ tools support|🧪 test tube experiment level|🧭 compass guide|📌 pin pinned|📍 location|📎 paperclip|✏️ pencil edit|📝 memo note apply|📖 book guide|📚 books|📜 scroll rules|📋 clipboard list|📅 calendar event|⏰ alarm clock time|⏳ hourglass waiting|💰 money bag|💵 dollar money|💳 card payment|🛒 cart shop store|🎫 ticket support|📦 package box|✉️ envelope mail|📨 incoming mail|🚀 rocket launch boost|🛡️ shield protect staff|⚔️ swords battle|🏠 home house|🌐 globe web language|🗳️ ballot vote poll'
	),
	group(
		'nature',
		'Nature & food',
		'🐶',
		'🐶 dog|🐱 cat|🦊 fox|🐻 bear|🐼 panda|🦁 lion|🐸 frog|🐵 monkey|🦄 unicorn|🐉 dragon|🦋 butterfly|🌸 blossom flower|🌹 rose|🌈 rainbow|☀️ sun sunny|🌙 moon night|⚡ lightning zap fast|❄️ snowflake cold|🌊 wave water|🍀 clover luck|🍕 pizza|🍔 burger|🍟 fries|🍩 donut|🍪 cookie|🎂 cake birthday|🍿 popcorn movie|☕ coffee|🍺 beer|🥤 drink'
	),
	group(
		'flags',
		'Flags',
		'🏁',
		'🏁 finish flag|🚩 red flag|🇺🇸 united states english|🇬🇧 united kingdom english|🇮🇩 indonesia|🇩🇪 germany german|🇪🇸 spain spanish|🇫🇷 france french|🇮🇹 italy italian|🇳🇱 netherlands dutch|🇸🇦 saudi arabia arabic|🇲🇾 malaysia malay|🇨🇳 china chinese|🇹🇼 taiwan|🇯🇵 japan japanese|🇰🇷 korea korean|🇧🇷 brazil portuguese|🇷🇺 russia russian|🇮🇳 india|🇵🇭 philippines|🇹🇷 turkey|🇻🇳 vietnam|🇹🇭 thailand'
	)
];
