// === INIT ===
const {
  Client, GatewayIntentBits, Partials,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  EmbedBuilder, Events
} = require("discord.js");
require("dotenv").config();

// === CONFIGURATION ===
const CHANNEL_ID = "1378448023625007287"; // Réactions
const SIGNAL_CHANNEL_ID = "1378660736150011956";
const REPORT_CHANNEL_ID = "1378661323054776400";
const PENDU_CHANNEL_ID = "1378737038261620806";
const CASINO_CHANNEL_ID = "1378822062558416966";
const LEADERBOARD_CHANNEL_ID = "1378893114592198761"; // ✔️ Corrigé ici

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// === PENDU ===
const mots = ["chat", "chien", "voiture", "ordinateur", "soleil"];
const parties = new Map();

function formatMot(mot, lettresTrouvees) {
  return mot.split("").map(l => (lettresTrouvees.includes(l) ? l : "_")).join(" ");
}
function dessinerPendu(erreurs) {
  const etapes = [
    `+---+\n|   |\n    |\n    |\n    |\n    |\n=========`,
    `+---+\n|   |\nO   |\n    |\n    |\n    |\n=========`,
    `+---+\n|   |\nO   |\n|   |\n    |\n    |\n=========`,
    `+---+\n|   |\nO   |\n/|  |\n    |\n    |\n=========`,
    `+---+\n|   |\nO   |\n/|\\ |\n    |\n    |\n=========`,
    `+---+\n|   |\nO   |\n/|\\ |\n/   |\n    |\n=========`,
    `+---+\n|   |\nO   |\n/|\\ |\n/ \\ |\n    |\n=========`
  ];
  return etapes[erreurs];
}

// === CASINO ===
const userBalances = new Map();
const userResultMessages = new Map();
let leaderboardMessageId = null;

function getRouletteButtons() {
  return new ActionRowBuilder().addComponents(
    ["bet_red", "bet_black", "bet_number", "reset_money"].map(id =>
      new ButtonBuilder().setCustomId(id).setLabel(
        id === "reset_money" ? "🔁 Reset solde" :
        id === "bet_red" ? "Rouge" :
        id === "bet_black" ? "Noir" : "Numéro"
      ).setStyle(ButtonStyle.Primary)
    )
  );
}

function lancerRoulette(choice, amount, numberChosen = null) {
  const number = Math.floor(Math.random() * 37);
  const color = number === 0 ? "green" : number % 2 === 0 ? "black" : "red";
  let gain = 0;
  if (choice === "red" && color === "red") gain = amount * 2;
  else if (choice === "black" && color === "black") gain = amount * 2;
  else if (choice === "number" && number === numberChosen) gain = amount * 36;
  return { number, color, gain };
}

function generateLeaderboardEmbed() {
  const sorted = [...userBalances.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const fields = sorted.map(([id, solde], i) => ({
    name: `#${i + 1}`,
    value: `<@${id}> : $${solde}`,
    inline: false,
  }));

  return new EmbedBuilder()
    .setTitle("🏆 Classement du Casino")
    .addFields(fields)
    .setColor(0xFFD700);
}

async function updateLeaderboard(client) {
  const channel = await client.channels.fetch(LEADERBOARD_CHANNEL_ID);
  if (!channel) return;

  if (leaderboardMessageId) {
    try {
      const msg = await channel.messages.fetch(leaderboardMessageId);
      const embed = generateLeaderboardEmbed();
      await msg.edit({ embeds: [embed] });
      return;
    } catch {
      leaderboardMessageId = null;
    }
  }

  const embed = generateLeaderboardEmbed();
  const msg = await channel.send({ embeds: [embed] });
  leaderboardMessageId = msg.id;
}

// === READY ===
client.once("ready", async () => {
  console.log(`🤖 Connecté : ${client.user.tag}`);

  const penduChannel = await client.channels.fetch(PENDU_CHANNEL_ID);
  if (penduChannel) {
    penduChannel.send("🪢 Tapez `!pendu` pour démarrer une partie !");
  }

  const casinoChannel = await client.channels.fetch(CASINO_CHANNEL_ID);
  if (casinoChannel) {
    const components = [getRouletteButtons()];
    for (const [userId, solde] of userBalances.entries()) {
      await casinoChannel.send({
        content: `🎰 Solde actuel de <@${userId}> : **$${solde}**`,
        components
      });
    }
    casinoChannel.send({
      content: "🎰 Bienvenue au **Casino** ! Choisissez une mise :",
      components
    });
  }

  const signalChannel = await client.channels.fetch(SIGNAL_CHANNEL_ID);
  if (signalChannel) {
    const button = new ButtonBuilder()
      .setCustomId("open_report_modal")
      .setLabel("📋 Signaler quelqu’un")
      .setStyle(ButtonStyle.Primary);

    signalChannel.send({
      content: "Cliquez pour signaler un comportement.",
      components: [new ActionRowBuilder().addComponents(button)]
    });
  }

  await updateLeaderboard(client);
});

// === INTERACTIONS ===
client.on(Events.InteractionCreate, async (interaction) => {
  const { customId, user, channel } = interaction;
  const isCasinoButton = ["bet_red", "bet_black", "bet_number", "reset_money"].includes(customId);

  if (interaction.isButton()) {
    if (customId === "open_report_modal") {
      const modal = new ModalBuilder().setCustomId("report_form").setTitle("🚨 Fiche de signalement");
      modal.addComponents(
        ["accuse", "crimes", "contexte", "preuves"].map(id =>
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId(id)
              .setLabel(id === "accuse" ? "Nom de l'accusé (@...)" :
                         id === "crimes" ? "Crimes reprochés" :
                         id === "contexte" ? "Contexte du drame" :
                         "Preuves (facultatif)")
              .setStyle(id === "contexte" || id === "preuves" ? TextInputStyle.Paragraph : TextInputStyle.Short)
              .setRequired(id !== "preuves")
          )
        )
      );
      return interaction.showModal(modal);
    }

    if (isCasinoButton && channel.id !== CASINO_CHANNEL_ID) {
      return interaction.reply({ content: "⛔ Ce bouton ne peut être utilisé que dans le salon casino.", ephemeral: true });
    }

    if (customId === "reset_money") {
      userBalances.set(user.id, 10000);
      await updateLeaderboard(client);
      return interaction.reply({ content: "💰 Votre solde a été réinitialisé à $10000.", ephemeral: true });
    }

    const modal = new ModalBuilder().setCustomId(`modal_${customId}`).setTitle("🎰 Mise en jeu");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("amount").setLabel("💸 Somme à miser").setStyle(TextInputStyle.Short).setRequired(true)
      )
    );
    if (customId === "bet_number") {
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("number").setLabel("🎯 Numéro choisi (0-36)").setStyle(TextInputStyle.Short).setRequired(true)
        )
      );
    }
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit()) {
    const [_, type] = interaction.customId.split("modal_");
    const amount = parseInt(interaction.fields.getTextInputValue("amount"));
    const userId = user.id;

    if (isNaN(amount) || amount <= 0) return interaction.reply({ content: "Montant invalide.", ephemeral: true });

    const current = userBalances.get(userId) ?? 10000;
    if (current < amount) return interaction.reply({ content: "💸 Solde insuffisant.", ephemeral: true });

    let result;
    if (type === "bet_red") result = lancerRoulette("red", amount);
    else if (type === "bet_black") result = lancerRoulette("black", amount);
    else if (type === "bet_number") {
      const chosen = parseInt(interaction.fields.getTextInputValue("number"));
      if (isNaN(chosen) || chosen < 0 || chosen > 36) return interaction.reply({ content: "❌ Numéro invalide.", ephemeral: true });
      result = lancerRoulette("number", amount, chosen);
    }

    const newSolde = current - amount + result.gain;
    userBalances.set(userId, newSolde);
    await updateLeaderboard(client);

    const prevMsg = userResultMessages.get(userId);
    if (prevMsg) {
      try { await prevMsg.delete(); } catch {}
    }

    const reply = await interaction.reply({
      content: `🎲 Numéro : **${result.number}** (${result.color})\n💰 Gain : **$${result.gain}**\n💼 Nouveau solde : **$${newSolde}**`,
      ephemeral: false,
      fetchReply: true
    });

    userResultMessages.set(userId, reply);
  }

  if (interaction.customId === "report_form") {
    const fields = id => interaction.fields.getTextInputValue(id);
    const embed = new EmbedBuilder()
      .setTitle("🚨 Nouveau signalement")
      .addFields(
        { name: "👤 Accusé", value: fields("accuse") },
        { name: "⚠️ Crimes", value: fields("crimes") },
        { name: "📜 Contexte", value: fields("contexte") },
        { name: "🧾 Preuves", value: fields("preuves") || "Aucune" }
      )
      .setColor(0xff0000)
      .setFooter({ text: `Signalé par ${user.tag}` })
      .setTimestamp();

    await interaction.reply({ content: "📬 Signalement transmis.", ephemeral: true });
    const channel = await client.channels.fetch(REPORT_CHANNEL_ID);
    channel?.send({ embeds: [embed] });
  }
});

// === COMMANDES (messageCreate) ===
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.channel.id === CHANNEL_ID) {
    try {
      await message.react("✅");
      await message.react("❌");
    } catch (err) {
      console.error(err);
    }
  }

  if (message.content === "!pendu" && message.channel.id === PENDU_CHANNEL_ID) {
    const mot = mots[Math.floor(Math.random() * mots.length)];
    parties.set(message.channel.id, { mot, lettresTrouvees: [], lettresProposees: [], erreurs: 0 });
    return message.channel.send(
      `🎮 **PENDU**\nMot : \`${formatMot(mot, [])}\`\n${dessinerPendu(0)}\n_Tapez une lettre pour jouer !_`
    );
  }

  const partie = parties.get(message.channel.id);
  if (partie && message.content.length === 1 && /^[a-zA-Z]$/.test(message.content)) {
    try { await message.delete(); } catch {}
    const lettre = message.content.toLowerCase();
    if (partie.lettresProposees.includes(lettre)) return;
    partie.lettresProposees.push(lettre);

    if (partie.mot.includes(lettre)) {
      partie.lettresTrouvees.push(lettre);
      const motFormate = formatMot(partie.mot, partie.lettresTrouvees);
      if (!motFormate.includes("_")) {
        parties.delete(message.channel.id);
        return message.channel.send(`✅ Gagné ! Le mot était \`${partie.mot}\``);
      }
      return message.channel.send(`✅ Bonne lettre !\nMot : \`${motFormate}\`\n${dessinerPendu(partie.erreurs)}`);
    } else {
      partie.erreurs++;
      if (partie.erreurs >= 6) {
        parties.delete(message.channel.id);
        return message.channel.send(`💀 Perdu ! Le mot était \`${partie.mot}\`\n${dessinerPendu(partie.erreurs)}`);
      }
      return message.channel.send(`❌ Mauvaise lettre !\nMot : \`${formatMot(partie.mot, partie.lettresTrouvees)}\`\n${dessinerPendu(partie.erreurs)}`);
    }
  }
});

// === LOGIN ===
client.login(process.env.TOKEN);
