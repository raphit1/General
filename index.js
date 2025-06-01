// Gestion des erreurs non gérées
process.on('unhandledRejection', e => console.error('Erreur non gérée :', e));

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

// Ping anti-sleep Render
setInterval(() => {
  require("http").get("https://TON-LIEN-RENDER.onrender.com"); // remplace par ton vrai lien
}, 5 * 60 * 1000);

// === CONFIGURATION ===
const CHANNEL_ID = "1378448023625007287"; // Réactions auto
const SIGNAL_CHANNEL_ID = "1378660736150011956"; // Bouton signalement
const REPORT_CHANNEL_ID = "1378661323054776400"; // Rapports

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

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

// ✅ Ajout des réactions automatiques
client.on("messageCreate", async (message) => {
  if (message.channel.id === CHANNEL_ID && !message.author.bot) {
    try {
      await message.react("✅");
      await message.react("❌");
    } catch (err) {
      console.error("❌ Erreur lors des réactions :", err);
    }
  }
});

// 📋 Interaction pour formulaire
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton() && interaction.customId === "open_report_modal") {
    const modal = new ModalBuilder()
      .setCustomId("report_form")
      .setTitle("🚨 Fiche de signalement");

    const inputs = [
      new TextInputBuilder().setCustomId("accuse").setLabel("Nom de l’accusé (@...)").setStyle(TextInputStyle.Short).setRequired(true),
      new TextInputBuilder().setCustomId("crimes").setLabel("Crimes reprochés").setStyle(TextInputStyle.Short).setRequired(true),
      new TextInputBuilder().setCustomId("contexte").setLabel("Contexte du drame").setStyle(TextInputStyle.Paragraph).setRequired(true),
      new TextInputBuilder().setCustomId("preuves").setLabel("Preuves (liens, screens...)").setStyle(TextInputStyle.Paragraph).setRequired(false)
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
// Remplace ces valeurs par les bons IDs
const ROLE_NON_VERIFIE_ID = "ID_ROLE_NON_VERIFIE";  // rôle donné à l'arrivée
const ROLE_MEMBRE_ID = "ID_ROLE_MEMBRE";            // rôle à donner après validation
const VALIDATION_MESSAGE_ID = "ID_MESSAGE_VALIDATION"; // message où il faut réagir avec ✅

client.on("messageReactionAdd", async (reaction, user) => {
  try {
    if (reaction.partial) await reaction.fetch();
    if (user.bot) return;

    if (
      reaction.message.id === VALIDATION_MESSAGE_ID &&
      reaction.emoji.name === "✅"
    ) {
      const member = await reaction.message.guild.members.fetch(user.id);

      // Supprime le rôle "non vérifié" et donne le rôle "membre"
      await member.roles.remove(ROLE_NON_VERIFIE_ID);
      await member.roles.add(ROLE_MEMBRE_ID);

      console.log(`✅ ${user.tag} validé avec succès !`);
    }
  } catch (error) {
    console.error("Erreur lors de la gestion de la réaction :", error);
  }
});
client.login(process.env.TOKEN);
