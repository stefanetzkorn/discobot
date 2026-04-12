import { SlashCommandBuilder, AttachmentBuilder, MessageFlags } from "discord.js";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { join } from "node:path";
import type { Command } from "../types.ts";

const IMAGE_PATH = join(import.meta.dir, "../../assets/teto.png");

GlobalFonts.registerFromPath(join(import.meta.dir, "../../assets/impact.ttf"), "Impact");

export default {
  data: new SlashCommandBuilder()
    .setName("tetowordoftheday")
    .setDescription("Reveals Teto's word of the day"),

  async execute(interaction) {
    const response = await fetch("https://random-word-api.herokuapp.com/word");

    if (!response.ok) {
      await interaction.reply({ content: "Could not fetch the word of the day. Try again later.", flags: [MessageFlags.Ephemeral] });
      return;
    }

    const [word] = await response.json() as [string];

    const bg = await loadImage(IMAGE_PATH);
    const canvas = createCanvas(bg.width, bg.height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(bg, 0, 0);

    // Scale font size to image width so it looks right on any image size.
    const fontSize = Math.max(48, Math.floor(bg.width / 8));
    ctx.font = `${fontSize}px Impact`;
    ctx.textAlign = "center";
    ctx.lineWidth = Math.max(4, fontSize / 8);
    ctx.strokeStyle = "black";
    ctx.strokeText(word, canvas.width / 2, canvas.height - 40);
    ctx.fillStyle = "white";
    ctx.fillText(word, canvas.width / 2, canvas.height - 40);

    const buffer = canvas.toBuffer("image/png");
    const attachment = new AttachmentBuilder(buffer, { name: "word-of-the-day.png" });

    await interaction.reply({ files: [attachment] });
  },
} satisfies Command;
