// === INIT ===
const express = require("express");
const {
  Client, GatewayIntentBits, Partials,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  EmbedBuilder, Events
} = require("discord.js");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot is alive"));
app.listen(PORT, () => console.log(`✅ Serveur web lancé sur le port ${PORT}`));

// Ping anti-sleep
setInterval(() => {
  require("http").get("https://TON-LIEN-RENDER.onrender.com");
}, 5 * 60 * 1000);

// === CONFIGURATION ===
const CHANNEL_ID = "1378448023625007287"; // Auto-réactions
const SIGNAL_CHANNEL_ID = "1378660736150011956";
const REPORT_CHANNEL_ID = "1378661323054776400";
const PENDU_BUTTON_CHANNEL_ID = "1378737038261620806";

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
const mots = [
  "chat", "chien", "voiture", "ordinateur", "soleil", "lune", "fromage", "bouteille",
  "maison", "fenetre", "pluie", "neige", "montagne", "rivière", "téléphone", "crayon",
  "papier", "livre", "histoire", "clavier", "coussin", "camion", "train", "vélo", "guitare", "musique", "chanson"
];
const parties = new Map();

function formatMot(mot, lettresTrouvees) {
  return mot.split("").map(l => (lettresTrouvees.includes(l) ? l : "_")).join(" ");
}

function dessinerPendu(erreurs) {
  const etapes = [
    "\n```\n+---+\n|   |\n    |\n    |\n    |\n    |\n=========\n```",
    "\n```\n+---+\n|   |\nO   |\n    |\n    |\n    |\n=========\n```",
    "\n```\n+---+\n|   |\nO   |\n|   |\n    |\n    |\n=========\n```",
    "\n```\n+---+\n|   |\nO   |\n/|  |\n    |\n    |\n=========\n```",
    "\n```\n+---+\n|   |\nO   |\n/|\\ |\n    |\n    |\n=========\n```",
    "\n```\n+---+\n|   |\nO   |\n/|\\ |\n/   |\n    |\n=========\n```",
    "\n```\n+---+\n|   |\nO   |\n/|\\ |\n/ \\ |\n    |\n=========\n```",
  ];
  return etapes[erreurs];
}

async function envoyerBoutonPendu(channel) {
  const bouton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("start_pendu")
      .setLabel("🎮 Rejouer au pendu 🪢")
      .setStyle(ButtonStyle.Success)
  );

  await channel.send({
    content: "**La partie est terminée ! Cliquez pour rejouer :**",
    components: [bouton],
  });
}

// === BOT READY ===
client.once("ready", async () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);

  const signalChannel = await client.channels.fetch(SIGNAL_CHANNEL_ID);
  if (signalChannel) {
    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_report_modal")
        .setLabel("📋 Signaler quelqu’un")
        .setStyle(ButtonStyle.Primary)
    );
    await signalChannel.send({
      content: "**Signalez un comportement inapproprié :**",
      components: [button],
    });
  }

  const penduChannel = await client.channels.fetch(PENDU_BUTTON_CHANNEL_ID);
  if (penduChannel) {
    const penduButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("start_pendu")
        .setLabel("🎮 Jouer au pendu 🪢")
        .setStyle(ButtonStyle.Success)
    );

    await penduChannel.send({
      content: "**Cliquez pour lancer une partie de pendu :**",
      components: [penduButton],
    });
  }
});

// === AUTO-RÉACTIONS ===
client.on("messageCreate", async (message) => {
  if (message.channel.id === CHANNEL_ID && !message.author.bot) {
    try {
      await message.react("✅");
      await message.react("❌");
    } catch (err) {
      console.error("❌ Erreur réactions :", err);
    }
  }

  // === PENDU ===
  const partie = parties.get(message.channel.id);

  if (message.content === "!pendu") {
    if (partie) {
      message.reply("⚠️ Une partie est déjà en cours ici !");
      return;
    }

    const mot = mots[Math.floor(Math.random() * mots.length)];
    const lettresTrouvees = [];
    const lettresProposees = [];
    const erreurs = 0;

    parties.set(message.channel.id, { mot, lettresTrouvees, lettresProposees, erreurs });

    await message.channel.send(`🎮 **NOUVELLE PARTIE DU PENDU**\nMot : \`${formatMot(mot, lettresTrouvees)}\`\n${dessinerPendu(erreurs)}\n_Proposez une lettre !_`);
    return;
  }

  // Si partie en cours et joueur propose une lettre
  if (partie && !message.author.bot && message.content.length === 1 && /^[a-zA-Z]$/.test(message.content)) {
    const lettre = message.content.toLowerCase();

    // Supprimer message du joueur
    try { await message.delete(); } catch (e) {}

    if (partie.lettresProposees.includes(lettre)) {
      const reply = await message.channel.send(`⚠️ **Lettre déjà proposée !**`);
      setTimeout(() => reply.delete().catch(() => {}), 3000);
      return;
    }

    partie.lettresProposees.push(lettre);

    if (partie.mot.includes(lettre)) {
      partie.lettresTrouvees.push(lettre);
      const motFormate = formatMot(partie.mot, partie.lettresTrouvees);

      if (!motFormate.includes("_")) {
        await message.channel.send(`✅ **Bravo !** Le mot était \`${partie.mot}\` 🎉`);
        parties.delete(message.channel.id);
        await envoyerBoutonPendu(message.channel);
      } else {
        await message.channel.send(`✅ Bonne lettre !\nMot : \`${motFormate}\`\n${dessinerPendu(partie.erreurs)}`);
      }
    } else {
      partie.erreurs += 1;

      if (partie.erreurs >= 6) {
        await message.channel.send(`💀 **Perdu !** Le mot était \`${partie.mot}\`\n${dessinerPendu(partie.erreurs)}`);
        parties.delete(message.channel.id);
        await envoyerBoutonPendu(message.channel);
      } else {
        await message.channel.send(`❌ Mauvaise lettre !\nMot : \`${formatMot(partie.mot, partie.lettresTrouvees)}\`\n${dessinerPendu(partie.erreurs)}`);
      }
    }
  }
});

// === INTERACTIONS ===
client.on(Events.InteractionCreate, async (interaction) => {
  // Signalement
  if (interaction.isButton() && interaction.customId === "open_report_modal") {
    const modal = new ModalBuilder().setCustomId("report_form").setTitle("🚨 Fiche de signalement");

    const inputs = [
      new TextInputBuilder().setCustomId("accuse").setLabel("Nom de l’accusé (@...)").setStyle(TextInputStyle.Short).setRequired(true),
      new TextInputBuilder().setCustomId("crimes").setLabel("Crimes reprochés").setStyle(TextInputStyle.Short).setRequired(true),
      new TextInputBuilder().setCustomId("contexte").setLabel("Contexte du drame").setStyle(TextInputStyle.Paragraph).setRequired(true),
      new TextInputBuilder().setCustomId("preuves").setLabel("Preuves (liens, screens...)").setStyle(TextInputStyle.Paragraph).setRequired(false),
    ];

    modal.addComponents(...inputs.map(input => new ActionRowBuilder().addComponents(input)));
    await interaction.showModal(modal);
  }

  // Envoi du signalement
  if (interaction.isModalSubmit() && interaction.customId === "report_form") {
    const getField = id => interaction.fields.getTextInputValue(id);
    const embed = new EmbedBuilder()
      .setTitle("🚨 Nouveau signalement")
      .addFields(
        { name: "👤 Nom de l’accusé", value: getField("accuse") },
        { name: "⚠️ Crimes reprochés", value: getField("crimes") },
        { name: "📜 Contexte", value: getField("contexte") },
        { name: "🧾 Preuves", value: getField("preuves") || "Aucune" }
      )
      .setColor(0xff0000)
      .setFooter({ text: `Signalé par ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ content: "📬 Signalement envoyé avec succès.", ephemeral: true });

    try {
      const reportChannel = await client.channels.fetch(REPORT_CHANNEL_ID);
      if (reportChannel) await reportChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error("❌ Erreur d'envoi du rapport :", err);
    }
  }

  // Lancer une nouvelle partie via bouton
  if (interaction.isButton() && interaction.customId === "start_pendu") {
    await interaction.deferUpdate();

    try {
      // Supprime le message contenant le bouton cliqué
      await interaction.message.delete();
    } catch (e) {}

    try {
      await interaction.channel.send("!pendu");
    } catch (err) {
      console.error("❌ Erreur en lançant !pendu :", err);
    }
  }
});

client.login(process.env.TOKEN);
