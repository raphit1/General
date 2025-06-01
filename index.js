// === INIT ===
const express = require("express");
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  Events,
} = require("discord.js");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot is alive"));
app.listen(PORT, () => console.log(`✅ Serveur web lancé sur le port ${PORT}`));

// Ping anti-sleep
setInterval(() => {
  require("http").get("https://TON-LIEN-RENDER.onrender.com"); // Remplace par ton vrai lien Render
}, 5 * 60 * 1000);

// === CONFIGURATION ===
const CHANNEL_ID = "1378448023625007287";         // Réactions auto
const SIGNAL_CHANNEL_ID = "1378660736150011956";  // Bouton signalement
const REPORT_CHANNEL_ID = "1378661323054776400";  // Canal des rapports

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// === PENDU ===
const mots = ["discord", "robot", "javascript", "fromage", "bouteille"];
const parties = new Map();

function formatMot(mot, lettresTrouvees) {
  return mot.split("").map(l => (lettresTrouvees.includes(l) ? l : "_")).join(" ");
}

function dessinerPendu(erreurs) {
  const etapes = [
    "```\n+---+\n|   |\n    |\n    |\n    |\n    |\n=========\n```",
    "```\n+---+\n|   |\nO   |\n    |\n    |\n    |\n=========\n```",
    "```\n+---+\n|   |\nO   |\n|   |\n    |\n    |\n=========\n```",
    "```\n+---+\n|   |\nO   |\n/|  |\n    |\n    |\n=========\n```",
    "```\n+---+\n|   |\nO   |\n/|\\ |\n    |\n    |\n=========\n```",
    "```\n+---+\n|   |\nO   |\n/|\\ |\n/   |\n    |\n=========\n```",
    "```\n+---+\n|   |\nO   |\n/|\\ |\n/ \\ |\n    |\n=========\n```",
  ];
  return etapes[erreurs];
}

// === BOT READY ===
client.once("ready", async () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(SIGNAL_CHANNEL_ID);
    if (channel) {
      const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("open_report_modal")
          .setLabel("📋 Signaler quelqu’un")
          .setStyle(ButtonStyle.Primary)
      );

      await channel.send({
        content: "**Signalez un comportement inapproprié via le formulaire ci-dessous :**",
        components: [button],
      });
    }
  } catch (err) {
    console.error("❌ Erreur en envoyant le bouton :", err);
  }
});

// === RÉACTIONS AUTOMATIQUES ===
client.on("messageCreate", async (message) => {
  if (message.channel.id === CHANNEL_ID && !message.author.bot) {
    try {
      await message.react("✅");
      await message.react("❌");
    } catch (err) {
      console.error("❌ Erreur lors des réactions :", err);
    }
  }

  // === JEU DU PENDU ===
  const partie = parties.get(message.channel.id);

  if (message.content === "!pendu") {
    if (partie) {
      message.reply("⚠️ Une partie est déjà en cours dans ce salon !");
      return;
    }

    const mot = mots[Math.floor(Math.random() * mots.length)];
    const lettresTrouvees = [];
    const lettresProposees = [];
    const erreurs = 0;

    parties.set(message.channel.id, { mot, lettresTrouvees, lettresProposees, erreurs });

    await message.channel.send(`🎮 Jeu du pendu lancé !\nMot : \`${formatMot(mot, lettresTrouvees)}\`\n${dessinerPendu(erreurs)}\nProposez une lettre !`);
    return;
  }

  if (partie && !message.author.bot && message.content.length === 1 && /^[a-zA-Z]$/.test(message.content)) {
    const lettre = message.content.toLowerCase();
    if (partie.lettresProposees.includes(lettre)) {
      message.reply("⚠️ Lettre déjà proposée !");
      return;
    }

    partie.lettresProposees.push(lettre);

    if (partie.mot.includes(lettre)) {
      partie.lettresTrouvees.push(lettre);
      const motFormate = formatMot(partie.mot, partie.lettresTrouvees);

      if (!motFormate.includes("_")) {
        await message.channel.send(`✅ Bravo ! Le mot était **${partie.mot}** 🎉`);
        parties.delete(message.channel.id);
      } else {
        await message.channel.send(`✅ Bonne lettre !\nMot : \`${motFormate}\`\n${dessinerPendu(partie.erreurs)}`);
      }
    } else {
      partie.erreurs += 1;
      if (partie.erreurs >= 6) {
        await message.channel.send(`💀 Partie terminée ! Le mot était **${partie.mot}**\n${dessinerPendu(partie.erreurs)}`);
        parties.delete(message.channel.id);
      } else {
        await message.channel.send(`❌ Mauvaise lettre !\nMot : \`${formatMot(partie.mot, partie.lettresTrouvees)}\`\n${dessinerPendu(partie.erreurs)}`);
      }
    }
  }
});

// === FORMULAIRE DE SIGNALLEMENT ===
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton() && interaction.customId === "open_report_modal") {
    const modal = new ModalBuilder()
      .setCustomId("report_form")
      .setTitle("🚨 Fiche de signalement");

    const inputs = [
      new TextInputBuilder().setCustomId("accuse").setLabel("Nom de l’accusé (@...)").setStyle(TextInputStyle.Short).setRequired(true),
      new TextInputBuilder().setCustomId("crimes").setLabel("Crimes reprochés").setStyle(TextInputStyle.Short).setRequired(true),
      new TextInputBuilder().setCustomId("contexte").setLabel("Contexte du drame").setStyle(TextInputStyle.Paragraph).setRequired(true),
      new TextInputBuilder().setCustomId("preuves").setLabel("Preuves (liens, screens...)").setStyle(TextInputStyle.Paragraph).setRequired(false),
    ];

    modal.addComponents(...inputs.map(input => new ActionRowBuilder().addComponents(input)));
    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === "report_form") {
    const getField = id => interaction.fields.getTextInputValue(id);
    const embed = new EmbedBuilder()
      .setTitle("🚨 Nouveau signalement")
      .addFields(
        { name: "👤 Nom de l’accusé", value: getField("accuse") },
        { name: "⚠️ Crimes reprochés", value: getField("crimes") },
        { name: "📜 Contexte", value: getField("contexte") },
        { name: "🧾 Preuves", value: getField("preuves") || "*Aucune preuve fournie*" }
      )
      .setColor(0xff0000)
      .setFooter({ text: `Signalé par ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ content: "📬 Votre signalement a été envoyé.", ephemeral: true });

    try {
      const reportChannel = await client.channels.fetch(REPORT_CHANNEL_ID);
      if (reportChannel) await reportChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error("❌ Erreur d'envoi du rapport :", err);
    }
  }
});

client.login(process.env.TOKEN);
