// === Gestion des erreurs non gérées === process.on("unhandledRejection", e => console.error("Erreur non gérée :", e));

// === Importation des modules === const express = require("express"); const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, Events, } = require("discord.js"); require("dotenv").config();

// === Setup Express === const app = express(); const PORT = process.env.PORT || 3000; app.get("/", (req, res) => res.send("Bot is alive")); app.listen(PORT, () => console.log(✅ Serveur web lancé sur le port ${PORT}));

// === Ping anti-sleep Render === setInterval(() => { require("http").get("https://TON-LIEN-RENDER.onrender.com"); }, 5 * 60 * 1000);

// === CONFIGURATION === const CHANNEL_ID = "1378448023625007287"; const SIGNAL_CHANNEL_ID = "1378660736150011956"; const REPORT_CHANNEL_ID = "1378661323054776400"; const GAME_CHANNEL_ID = "1378737038261620806";

const ROLE_NON_VERIFIE_ID = "ID_ROLE_NON_VERIFIE"; const ROLE_MEMBRE_ID = "ID_ROLE_MEMBRE"; const VALIDATION_MESSAGE_ID = "ID_MESSAGE_VALIDATION";

// === Client Discord === const client = new Client({ intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessageReactions ], partials: [Partials.Message, Partials.Channel, Partials.Reaction], });

client.once("ready", async () => { console.log(🤖 Connecté en tant que ${client.user.tag});

// Bouton signalement try { const channel = await client.channels.fetch(SIGNAL_CHANNEL_ID); if (channel) { const button = new ActionRowBuilder().addComponents( new ButtonBuilder() .setCustomId("open_report_modal") .setLabel("📋 Signaler quelqu’un") .setStyle(ButtonStyle.Primary) ); await channel.send({ content: "Signalez un comportement inapproprié via le formulaire ci-dessous :", components: [button], }); } } catch (err) { console.error("❌ Erreur en envoyant le bouton :", err); }

// Bouton de lancement du jeu Plus ou Moins try { const gameChannel = await client.channels.fetch(GAME_CHANNEL_ID); if (gameChannel) { const button = new ActionRowBuilder().addComponents( new ButtonBuilder() .setCustomId("start_guess") .setLabel("🎯 Jouer au Plus ou Moins") .setStyle(ButtonStyle.Success) );

await gameChannel.send({
    content: "Envie de jouer au jeu du Plus ou Moins ? Clique ci-dessous :",
    components: [button],
  });
}

} catch (err) { console.error("❌ Erreur lors de l'envoi du bouton de jeu :", err); } });

// === Ajout des réactions automatiques === client.on("messageCreate", async (message) => { if (message.channel.id === CHANNEL_ID && !message.author.bot) { try { await message.react("✅"); await message.react("❌"); } catch (err) { console.error("❌ Erreur lors des réactions :", err); } } });

// === Gestion des signalements === client.on(Events.InteractionCreate, async (interaction) => { if (interaction.isButton() && interaction.customId === "open_report_modal") { const modal = new ModalBuilder() .setCustomId("report_form") .setTitle("🚨 Fiche de signalement");

const inputs = [
  new TextInputBuilder().setCustomId("accuse").setLabel("Nom de l’accusé (@...)").setStyle(TextInputStyle.Short).setRequired(true),
  new TextInputBuilder().setCustomId("crimes").setLabel("Crimes reprochés").setStyle(TextInputStyle.Short).setRequired(true),
  new TextInputBuilder().setCustomId("contexte").setLabel("Contexte du drame").setStyle(TextInputStyle.Paragraph).setRequired(true),
  new TextInputBuilder().setCustomId("preuves").setLabel("Preuves (liens, screens...)").setStyle(TextInputStyle.Paragraph).setRequired(false)
];

modal.addComponents(...inputs.map(input => new ActionRowBuilder().addComponents(input)));
await interaction.showModal(modal);

}

if (interaction.isModalSubmit() && interaction.customId === "report_form") { const getField = id => interaction.fields.getTextInputValue(id); const embed = new EmbedBuilder() .setTitle("🚨 Nouveau signalement") .addFields( { name: "👤 Nom de l’accusé", value: getField("accuse") }, { name: "⚠️ Crimes reprochés", value: getField("crimes") }, { name: "📜 Contexte", value: getField("contexte") }, { name: "🧾 Preuves", value: getField("preuves") || "Aucune preuve fournie" } ) .setColor(0xff0000) .setFooter({ text: Signalé par ${interaction.user.tag} }) .setTimestamp();

await interaction.reply({ content: "📬 Votre signalement a été envoyé.", ephemeral: true });

try {
  const reportChannel = await client.channels.fetch(REPORT_CHANNEL_ID);
  if (reportChannel) await reportChannel.send({ embeds: [embed] });
} catch (err) {
  console.error("❌ Erreur d'envoi du rapport :", err);
}

} });

// === Validation utilisateur via réaction === client.on("messageReactionAdd", async (reaction, user) => { try { if (reaction.partial) await reaction.fetch(); if (user.bot) return;

if (
  reaction.message.id === VALIDATION_MESSAGE_ID &&
  reaction.emoji.name === "✅"
) {
  const member = await reaction.message.guild.members.fetch(user.id);
  await member.roles.remove(ROLE_NON_VERIFIE_ID);
  await member.roles.add(ROLE_MEMBRE_ID);
  console.log(`✅ ${user.tag} validé avec succès !`);
}

} catch (error) { console.error("Erreur lors de la gestion de la réaction :", error); } });

// === Jeu du Plus ou Moins === const guessingGames = new Map();

client.on(Events.InteractionCreate, async (interaction) => { if (interaction.isButton() && interaction.customId === "start_guess") { const target = Math.floor(Math.random() * 100) + 1; guessingGames.set(interaction.user.id, { target, attempts: 0 });

const modal = new ModalBuilder()
  .setCustomId("guess_modal")
  .setTitle("🎯 Devine un nombre entre 1 et 100")
  .addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("guess_input")
        .setLabel("Ta proposition")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    )
  );

await interaction.showModal(modal);

}

if (interaction.isModalSubmit() && interaction.customId === "guess_modal") { const guess = parseInt(interaction.fields.getTextInputValue("guess_input"), 10); const game = guessingGames.get(interaction.user.id);

if (!game || isNaN(guess)) {
  await interaction.reply({ content: "⛔ Entrée invalide ou partie introuvable.", ephemeral: true });
  return;
}

game.attempts++;

if (guess === game.target) {
  await interaction.reply({ content: `🎉 Bravo ! Tu as trouvé le nombre **${game.target}** en ${game.attempts} essais.`, ephemeral: true });
  guessingGames.delete(interaction.user.id);
} else {
  const hint = guess < game.target ? "🔼 Plus grand" : "🔽 Plus petit";
  const modal = new ModalBuilder()
    .setCustomId("guess_modal")
    .setTitle(`💡 ${hint} - Tentative ${game.attempts}`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("guess_input")
          .setLabel("Nouvelle tentative")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );

  await interaction.reply({ content: `${hint} ! Tente encore !`, ephemeral: true });
  setTimeout(() => {
    interaction.user.send({ content: `🧠 Rejoue avec le bouton dans <#${GAME_CHANNEL_ID}>.` }).catch(() => {});
  }, 3000);
}

} });

// === Connexion === client.login(process.env.TOKEN);
