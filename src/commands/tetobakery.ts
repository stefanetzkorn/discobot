import {
  SlashCommandBuilder,
  MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { join } from "node:path";
import type { ButtonInteraction } from "discord.js";
import type { Command } from "../types.ts";
import { sql } from "../database.ts";

const UPGRADES = {
  oven: {
    column: "ovens" as const,
    cost: 10,
    rate: 1,
    label: "Oven",
    description: "A basic oven for baking baguettes",
  },
  mega_oven: {
    column: "mega_ovens" as const,
    cost: 150,
    rate: 8,
    label: "Mega Oven",
    description: "Industrial-grade baguette production",
  },
  secret_recipe: {
    column: "secret_recipes" as const,
    cost: 800,
    rate: 50,
    label: "Secret Recipe",
    description: "Teto's legendary baguette formula",
  },
  baguette_machine: {
    column: "baguette_machines" as const,
    cost: 5000,
    rate: 350,
    label: "Baguette Machine",
    description: "Fully automated baguette empire",
  },
} as const;

type UpgradeKey = keyof typeof UPGRADES;

interface BakeryRow {
  user_id: string;
  guild_id: string;
  baguettes: string; // NUMERIC comes back as string from Bun.sql
  last_collected_at: Date;
  ovens: number;
  mega_ovens: number;
  secret_recipes: number;
  baguette_machines: number;
}

type MessageContent = {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
};

function baguettesPerMinute(row: BakeryRow): number {
  return (
    1 +
    row.ovens * 1 +
    row.mega_ovens * 8 +
    row.secret_recipes * 50 +
    row.baguette_machines * 350
  );
}

function pendingBaguettes(row: BakeryRow): number {
  const minutes =
    (Date.now() - new Date(row.last_collected_at).getTime()) / 60_000;
  const bpm = baguettesPerMinute(row);
  return Math.min(minutes * bpm, bpm * 1440);
}

function formatBaguettes(amount: number): string {
  return `${Math.floor(amount).toLocaleString()} 🥖`;
}

async function getOrCreateRow(userId: string, guildId: string): Promise<BakeryRow> {
  const rows = await sql<BakeryRow[]>`
    INSERT INTO teto_bakery (user_id, guild_id)
    VALUES (${userId}, ${guildId})
    ON CONFLICT (user_id, guild_id) DO UPDATE SET user_id = EXCLUDED.user_id
    RETURNING *
  `;
  return rows[0]!;
}

function buildStatusView(row: BakeryRow, result?: string): MessageContent {
  const bpm = baguettesPerMinute(row);
  const pending = pendingBaguettes(row);
  const stored = parseFloat(row.baguettes);
  const minutesSinceCollect =
    (Date.now() - new Date(row.last_collected_at).getTime()) / 60_000;
  const lastCollectedText =
    minutesSinceCollect < 60
      ? `${Math.floor(minutesSinceCollect)}m ago`
      : `${Math.floor(minutesSinceCollect / 60)}h ${Math.floor(minutesSinceCollect % 60)}m ago`;

  const embed = new EmbedBuilder()
    .setTitle("🥖 Teto's Baguette Bakery")
    .setColor(0xe8b86d)
    .addFields(
      { name: "Baguettes stored", value: formatBaguettes(stored), inline: true },
      { name: "Production rate", value: `${bpm}/min`, inline: true },
      { name: "Uncollected", value: formatBaguettes(pending), inline: true },
      { name: "Last collected", value: lastCollectedText, inline: true },
      {
        name: "Upgrades",
        value: [
          `Ovens: **${row.ovens}**`,
          `Mega Ovens: **${row.mega_ovens}**`,
          `Secret Recipes: **${row.secret_recipes}**`,
          `Baguette Machines: **${row.baguette_machines}**`,
        ].join("  ·  "),
        inline: false,
      }
    );

  if (result) embed.setDescription(result);

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("tetobakery:collect")
      .setLabel("Collect")
      .setEmoji("🥖")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("tetobakery:shop")
      .setLabel("Shop")
      .setEmoji("🏪")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("tetobakery:teto")
      .setLabel("Show your Teto")
      .setEmoji("🐷")
      .setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [row1] };
}

function buildShopView(row: BakeryRow, result?: string): MessageContent {
  const available = parseFloat(row.baguettes) + pendingBaguettes(row);

  const lines = Object.entries(UPGRADES).map(([, upg]) => {
    const owned = row[upg.column as keyof BakeryRow] as number;
    const canAfford = available >= upg.cost ? "✅" : "❌";
    return `${canAfford} **${upg.label}** — ${upg.cost} 🥖 → +${upg.rate}/min  *(owned: ${owned})*`;
  });

  const embed = new EmbedBuilder()
    .setTitle("🏪 Teto's Upgrade Shop")
    .setColor(0xe8b86d)
    .setDescription(
      `Your baguettes (incl. uncollected): **${formatBaguettes(available)}**\n\n` +
        lines.join("\n")
    );

  if (result) embed.setFooter({ text: result });

  const upgradeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("tetobakery:upgrade:oven")
      .setLabel(`Oven · 10 🥖`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(available < UPGRADES.oven.cost),
    new ButtonBuilder()
      .setCustomId("tetobakery:upgrade:mega_oven")
      .setLabel(`Mega Oven · 150 🥖`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(available < UPGRADES.mega_oven.cost),
    new ButtonBuilder()
      .setCustomId("tetobakery:upgrade:secret_recipe")
      .setLabel(`Secret Recipe · 800 🥖`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(available < UPGRADES.secret_recipe.cost),
    new ButtonBuilder()
      .setCustomId("tetobakery:upgrade:baguette_machine")
      .setLabel(`Machine · 5000 🥖`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(available < UPGRADES.baguette_machine.cost),
    new ButtonBuilder()
      .setCustomId("tetobakery:status")
      .setLabel("Back")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [upgradeRow] };
}

export default {
  data: new SlashCommandBuilder()
    .setName("tetobakery")
    .setDescription("Teto's Baguette Bakery — the idle baguette empire"),

  async execute(interaction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const row = await getOrCreateRow(interaction.user.id, interaction.guildId);
    await interaction.reply({
      ...buildStatusView(row),
      flags: [MessageFlags.Ephemeral],
    });
  },

  async handleButton(interaction: ButtonInteraction) {
    const guildId = interaction.guildId;
    if (!guildId) return;

    const [, action, param] = interaction.customId.split(":");
    const userId = interaction.user.id;

    if (action === "status") {
      const row = await getOrCreateRow(userId, guildId);
      await interaction.update(buildStatusView(row));
      return;
    }

    if (action === "collect") {
      const row = await getOrCreateRow(userId, guildId);
      const gained = pendingBaguettes(row);

      await sql`
        UPDATE teto_bakery
        SET baguettes = baguettes + ${gained},
            last_collected_at = NOW()
        WHERE user_id = ${userId} AND guild_id = ${guildId}
      `;

      const updatedRow: BakeryRow = {
        ...row,
        baguettes: String(parseFloat(row.baguettes) + gained),
        last_collected_at: new Date(),
      };

      const result =
        gained < 0.01
          ? "Nothing to collect yet — check back after a minute!"
          : `✅ Collected ${formatBaguettes(gained)}!`;

      await interaction.update(buildStatusView(updatedRow, result));
      return;
    }

    if (action === "teto") {
      const row = await getOrCreateRow(userId, guildId);
      const totalBaguettes = parseFloat(row.baguettes) + pendingBaguettes(row);
      const weightTons = (totalBaguettes / 1000).toFixed(2);
      const displayName = interaction.user.globalName ?? interaction.user.username;

      const attachment = new AttachmentBuilder(
        join(import.meta.dir, "../../assets/fatass.png"),
        { name: "teto.png" }
      );

      await interaction.deferUpdate();
      await interaction.followUp({
        content: `**${displayName}'s Teto** weighs **${weightTons} Tons**. What a Fatass!`,
        files: [attachment],
      });
      return;
    }

    if (action === "shop") {
      const row = await getOrCreateRow(userId, guildId);
      await interaction.update(buildShopView(row));
      return;
    }

    if (action === "upgrade" && param) {
      const item = param as UpgradeKey;
      const upg = UPGRADES[item];
      if (!upg) return;

      const row = await getOrCreateRow(userId, guildId);
      const stored = parseFloat(row.baguettes);

      if (stored < upg.cost) {
        await interaction.update(
          buildShopView(row, `❌ Not enough baguettes — need ${formatBaguettes(upg.cost)}, have ${formatBaguettes(stored)}`)
        );
        return;
      }

      let updatedRow: BakeryRow;
      switch (item) {
        case "oven":
          await sql`UPDATE teto_bakery SET baguettes = baguettes - ${upg.cost}, ovens = ovens + 1 WHERE user_id = ${userId} AND guild_id = ${guildId}`;
          updatedRow = { ...row, baguettes: String(stored - upg.cost), ovens: row.ovens + 1 };
          break;
        case "mega_oven":
          await sql`UPDATE teto_bakery SET baguettes = baguettes - ${upg.cost}, mega_ovens = mega_ovens + 1 WHERE user_id = ${userId} AND guild_id = ${guildId}`;
          updatedRow = { ...row, baguettes: String(stored - upg.cost), mega_ovens: row.mega_ovens + 1 };
          break;
        case "secret_recipe":
          await sql`UPDATE teto_bakery SET baguettes = baguettes - ${upg.cost}, secret_recipes = secret_recipes + 1 WHERE user_id = ${userId} AND guild_id = ${guildId}`;
          updatedRow = { ...row, baguettes: String(stored - upg.cost), secret_recipes: row.secret_recipes + 1 };
          break;
        case "baguette_machine":
          await sql`UPDATE teto_bakery SET baguettes = baguettes - ${upg.cost}, baguette_machines = baguette_machines + 1 WHERE user_id = ${userId} AND guild_id = ${guildId}`;
          updatedRow = { ...row, baguettes: String(stored - upg.cost), baguette_machines: row.baguette_machines + 1 };
          break;
        default:
          return;
      }

      const newBpm = baguettesPerMinute(updatedRow);
      await interaction.update(
        buildShopView(updatedRow, `✅ Purchased ${upg.label}! New rate: ${newBpm}/min`)
      );
    }
  },
} satisfies Command;
