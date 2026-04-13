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
import { createCanvas, loadImage } from "@napi-rs/canvas";
import type { Command } from "../types.ts";
import { sql } from "../database.ts";

// ---------------------------------------------------------------------------
// Upgrades — exponential cost scaling: Nth purchase costs floor(base * mult^(N-1))
// ---------------------------------------------------------------------------
const UPGRADES = {
  oven: {
    column: "ovens" as const,
    cost: 100,
    costMultiplier: 1.5,
    rate: 1,
    label: "Oven",
    description: "A basic oven for baking baguettes",
  },
  mega_oven: {
    column: "mega_ovens" as const,
    cost: 2_000,
    costMultiplier: 1.5,
    rate: 8,
    label: "Mega Oven",
    description: "Industrial-grade baguette production",
  },
  secret_recipe: {
    column: "secret_recipes" as const,
    cost: 20_000,
    costMultiplier: 1.5,
    rate: 50,
    label: "Secret Recipe",
    description: "Teto's legendary baguette formula",
  },
  baguette_machine: {
    column: "baguette_machines" as const,
    cost: 200_000,
    costMultiplier: 1.5,
    rate: 350,
    label: "Baguette Machine",
    description: "Fully automated baguette empire",
  },
} as const;

type UpgradeKey = keyof typeof UPGRADES;

function upgradeCost(upg: { cost: number; costMultiplier: number }, owned: number): number {
  return Math.floor(upg.cost * upg.costMultiplier ** owned);
}

// ---------------------------------------------------------------------------
// Decorations — one-time flat-cost purchases, overlaid on the Teto image
// ---------------------------------------------------------------------------
const DECORATIONS = {
  jukebox:     { emoji: "🎵", label: "Teto's Jukebox",    cost: 500 },
  flower_pot:  { emoji: "🌸", label: "Flower Pot",        cost: 2_000 },
  rabbit:      { emoji: "🐰", label: "Rabbit Helper",     cost: 8_000 },
  gold_case:   { emoji: "✨", label: "Gold Display Case", cost: 30_000 },
  disco_ball:  { emoji: "🪩", label: "Disco Ball",        cost: 100_000 },
} as const;

type DecorationKey = keyof typeof DECORATIONS;

// ---------------------------------------------------------------------------
// Database types
// ---------------------------------------------------------------------------
interface BakeryRow {
  user_id: string;
  guild_id: string;
  baguettes: string; // NUMERIC comes back as string from Bun.sql
  total_produced: string;
  last_collected_at: Date;
  ovens: number;
  mega_ovens: number;
  secret_recipes: number;
  baguette_machines: number;
  decorations: string[];
}

type MessageContent = {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function baguettesPerMinute(row: BakeryRow): number {
  return (
    0.5 +
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

// ---------------------------------------------------------------------------
// View builders
// ---------------------------------------------------------------------------
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

  const ownedDecorEmojis = row.decorations
    .map((id) => DECORATIONS[id as DecorationKey]?.emoji)
    .filter(Boolean)
    .join(" ");

  const embed = new EmbedBuilder()
    .setTitle("🥖 Teto's Baguette Bakery")
    .setColor(0xe8b86d)
    .addFields(
      { name: "Baguettes stored", value: formatBaguettes(stored), inline: true },
      { name: "Production rate", value: `${bpm}/min`, inline: true },
      { name: "Uncollected", value: formatBaguettes(pending), inline: true },
      { name: "Last collected", value: lastCollectedText, inline: true },
      { name: "Total ever produced", value: formatBaguettes(parseFloat(row.total_produced)), inline: true },
      {
        name: "Upgrades",
        value: [
          `Ovens: **${row.ovens}**`,
          `Mega Ovens: **${row.mega_ovens}**`,
          `Secret Recipes: **${row.secret_recipes}**`,
          `Baguette Machines: **${row.baguette_machines}**`,
        ].join("  ·  "),
        inline: false,
      },
      {
        name: "Decorations",
        value: ownedDecorEmojis || "None yet",
        inline: false,
      }
    );

  if (result) embed.setDescription(result);

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
      .setCustomId("tetobakery:decorations")
      .setLabel("Decorations")
      .setEmoji("🎨")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("tetobakery:teto")
      .setLabel("Show your Teto")
      .setEmoji("🐷")
      .setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [buttons] };
}

function buildShopView(row: BakeryRow, result?: string): MessageContent {
  const stored = parseFloat(row.baguettes);

  const lines = (Object.entries(UPGRADES) as [UpgradeKey, typeof UPGRADES[UpgradeKey]][]).map(([, upg]) => {
    const owned = row[upg.column as keyof BakeryRow] as number;
    const nextCost = upgradeCost(upg, owned);
    const canAfford = stored >= nextCost ? "✅" : "❌";
    return `${canAfford} **${upg.label}** — ${formatBaguettes(nextCost)} → +${upg.rate}/min  *(owned: ${owned})*`;
  });

  const embed = new EmbedBuilder()
    .setTitle("🏪 Teto's Upgrade Shop")
    .setColor(0xe8b86d)
    .setDescription(`Your baguettes: **${formatBaguettes(stored)}**\n\n` + lines.join("\n"));

  if (result) embed.setFooter({ text: result });

  const upgradeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...(Object.entries(UPGRADES) as [UpgradeKey, typeof UPGRADES[UpgradeKey]][]).map(([key, upg]) => {
      const owned = row[upg.column as keyof BakeryRow] as number;
      const nextCost = upgradeCost(upg, owned);
      return new ButtonBuilder()
        .setCustomId(`tetobakery:upgrade:${key}`)
        .setLabel(`${upg.label} · ${Math.floor(nextCost).toLocaleString()} 🥖`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(stored < nextCost);
    }),
    new ButtonBuilder()
      .setCustomId("tetobakery:status")
      .setLabel("Back")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [upgradeRow] };
}

function buildDecorationsView(row: BakeryRow, result?: string): MessageContent {
  const stored = parseFloat(row.baguettes);
  const owned = new Set(row.decorations);

  const lines = (Object.entries(DECORATIONS) as [DecorationKey, typeof DECORATIONS[DecorationKey]][]).map(
    ([id, dec]) => {
      if (owned.has(id)) return `✅ ${dec.emoji} **${dec.label}** — owned`;
      const canAfford = stored >= dec.cost ? "✅" : "❌";
      return `${canAfford} ${dec.emoji} **${dec.label}** — ${formatBaguettes(dec.cost)}`;
    }
  );

  const embed = new EmbedBuilder()
    .setTitle("🎨 Teto's Decoration Shop")
    .setColor(0xb86de8)
    .setDescription(`Your baguettes: **${formatBaguettes(stored)}**\n\n` + lines.join("\n"));

  if (result) embed.setFooter({ text: result });

  const decorRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...(Object.entries(DECORATIONS) as [DecorationKey, typeof DECORATIONS[DecorationKey]][]).map(([id, dec]) => {
      const isOwned = owned.has(id);
      return new ButtonBuilder()
        .setCustomId(`tetobakery:buy_decoration:${id}`)
        .setLabel(isOwned ? `✅ ${dec.label}` : `${dec.emoji} ${dec.label} · ${dec.cost.toLocaleString()} 🥖`)
        .setStyle(isOwned ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(isOwned || stored < dec.cost);
    })
  );

  const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("tetobakery:status")
      .setLabel("Back")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [decorRow, backRow] };
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------
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
            total_produced = total_produced + ${gained},
            last_collected_at = NOW()
        WHERE user_id = ${userId} AND guild_id = ${guildId}
      `;

      const updatedRow: BakeryRow = {
        ...row,
        baguettes: String(parseFloat(row.baguettes) + gained),
        total_produced: String(parseFloat(row.total_produced) + gained),
        last_collected_at: new Date(),
      };

      const result =
        gained < 0.01
          ? "Nothing to collect yet — check back after a minute!"
          : `✅ Collected ${formatBaguettes(gained)}!`;

      await interaction.update(buildStatusView(updatedRow, result));
      return;
    }

    if (action === "shop") {
      const row = await getOrCreateRow(userId, guildId);
      await interaction.update(buildShopView(row));
      return;
    }

    if (action === "decorations") {
      const row = await getOrCreateRow(userId, guildId);
      await interaction.update(buildDecorationsView(row));
      return;
    }

    if (action === "teto") {
      const row = await getOrCreateRow(userId, guildId);
      const weightTons = (parseFloat(row.total_produced) / 1000).toFixed(2);
      const displayName = interaction.user.globalName ?? interaction.user.username;

      // Composite fatass.png with any owned decoration layers
      const base = await loadImage(join(import.meta.dir, "../../assets/fatass.png"));
      const canvas = createCanvas(base.width, base.height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(base, 0, 0);

      for (const decorId of row.decorations) {
        try {
          const img = await loadImage(
            join(import.meta.dir, `../../assets/decorations/${decorId}.png`)
          );
          const decorWidth = Math.floor(base.width * (0.15 + Math.random() * 0.10));
          const decorHeight = Math.floor(decorWidth * (img.height / img.width));
          const x = Math.floor(Math.random() * (base.width - decorWidth));
          const y = Math.floor(Math.random() * (base.height - decorHeight));
          ctx.drawImage(img, x, y, decorWidth, decorHeight);
        } catch {
          // decoration PNG missing — skip silently
        }
      }

      const attachment = new AttachmentBuilder(canvas.toBuffer("image/png"), { name: "teto.png" });

      await interaction.deferUpdate();
      if (interaction.channel?.isSendable()) {
        await interaction.channel.send({
          content: `**${displayName}'s Teto** weighs **${weightTons} Tons**. What a Fatass!`,
          files: [attachment],
        });
      }
      return;
    }

    if (action === "upgrade" && param) {
      const item = param as UpgradeKey;
      const upg = UPGRADES[item];
      if (!upg) return;

      const row = await getOrCreateRow(userId, guildId);
      const stored = parseFloat(row.baguettes);
      const owned = row[upg.column as keyof BakeryRow] as number;
      const cost = upgradeCost(upg, owned);

      if (stored < cost) {
        await interaction.update(
          buildShopView(row, `❌ Not enough baguettes — need ${formatBaguettes(cost)}, have ${formatBaguettes(stored)}`)
        );
        return;
      }

      let updatedRow: BakeryRow;
      switch (item) {
        case "oven":
          await sql`UPDATE teto_bakery SET baguettes = baguettes - ${cost}, ovens = ovens + 1 WHERE user_id = ${userId} AND guild_id = ${guildId}`;
          updatedRow = { ...row, baguettes: String(stored - cost), ovens: row.ovens + 1 };
          break;
        case "mega_oven":
          await sql`UPDATE teto_bakery SET baguettes = baguettes - ${cost}, mega_ovens = mega_ovens + 1 WHERE user_id = ${userId} AND guild_id = ${guildId}`;
          updatedRow = { ...row, baguettes: String(stored - cost), mega_ovens: row.mega_ovens + 1 };
          break;
        case "secret_recipe":
          await sql`UPDATE teto_bakery SET baguettes = baguettes - ${cost}, secret_recipes = secret_recipes + 1 WHERE user_id = ${userId} AND guild_id = ${guildId}`;
          updatedRow = { ...row, baguettes: String(stored - cost), secret_recipes: row.secret_recipes + 1 };
          break;
        case "baguette_machine":
          await sql`UPDATE teto_bakery SET baguettes = baguettes - ${cost}, baguette_machines = baguette_machines + 1 WHERE user_id = ${userId} AND guild_id = ${guildId}`;
          updatedRow = { ...row, baguettes: String(stored - cost), baguette_machines: row.baguette_machines + 1 };
          break;
        default:
          return;
      }

      const newBpm = baguettesPerMinute(updatedRow);
      await interaction.update(
        buildShopView(updatedRow, `✅ Purchased ${upg.label}! New rate: ${newBpm.toFixed(1)}/min`)
      );
      return;
    }

    if (action === "buy_decoration" && param) {
      const id = param as DecorationKey;
      const dec = DECORATIONS[id];
      if (!dec) return;

      const row = await getOrCreateRow(userId, guildId);
      const stored = parseFloat(row.baguettes);

      if (row.decorations.includes(id)) {
        await interaction.update(buildDecorationsView(row, "You already own that decoration!"));
        return;
      }

      if (stored < dec.cost) {
        await interaction.update(
          buildDecorationsView(row, `❌ Not enough baguettes — need ${formatBaguettes(dec.cost)}, have ${formatBaguettes(stored)}`)
        );
        return;
      }

      await sql`
        UPDATE teto_bakery
        SET baguettes = baguettes - ${dec.cost},
            decorations = array_append(decorations, ${id})
        WHERE user_id = ${userId} AND guild_id = ${guildId}
      `;

      const updatedRow: BakeryRow = {
        ...row,
        baguettes: String(stored - dec.cost),
        decorations: [...row.decorations, id],
      };

      await interaction.update(
        buildDecorationsView(updatedRow, `✅ Purchased ${dec.emoji} ${dec.label}! It'll appear on your Teto.`)
      );
      return;
    }
  },
} satisfies Command;
