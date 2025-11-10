import { getEmbedConfig } from "../../../config.js";
import { EmbedBuilder } from "discord.js";
import { hasPermission } from "../permissions.js";

export async function handleHelpButton(interaction) {

    if (!(await hasPermission(interaction.member, 'help'))) {
        await interaction.reply({
            content: '❌ You don\'t have permission to view help.',
            flags: 64
        });
        return;
    }
    
    const embedConfig = await getEmbedConfig(interaction.guild.id);
    const helpEmbed = new EmbedBuilder()
        .setColor(embedConfig.COLOR)
        .setTitle("🤖 GO BLOX Bot - Help")
        .setDescription("Use the buttons below to interact with the bot. All responses are private.")
        .addFields([
            {
                name: "📤 Send Message",
                value: "Send custom embed messages to any channel.\n**Permission:** Staff+",
                inline: true
            },
            {
                name: "💎 Custom Supporter Role",
                value: "Create, edit, or delete your custom role.\n**Permission:** Supporter+",
                inline: true
            },
            {
                name: "📈 Leveling",
                value: "View your stats and leaderboard.\n**XP:** +10 per message (15s cooldown), +30/min voice, +5/min AFK\n**Permission:** Member+",
                inline: true
            },
            {
                name: "⏸️ AFK",
                value: "Set AFK status with optional message.\n**Permission:** Member+",
                inline: true
            },
            {
                name: "💬 Feedback",
                value: "Submit feedback to staff.\n**Permission:** Member+",
                inline: true
            },
            {
                name: "🔐 Permissions",
                value: "**Admin:** Full access\n**Staff:** All features\n**Supporter:** Custom role + Member\n**Member:** Leveling, AFK, Help, Feedback",
                inline: false
            }
        ])
        .setFooter({ text: embedConfig.FOOTER })
        .setTimestamp();

    await interaction.reply({
        embeds: [helpEmbed],
        flags: 64
    });
}
