// === INIT ===
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
  Events
} = require("discord.js");
require("dotenv").config();

// === CONFIGURATION ===
const CHANNEL_ID = "1378448023625007287"; // Réactions
const SIGNAL_CHANNEL_ID = "1378660736150011956";
const REPORT_CHANNEL_ID = "1378661323054776400";
const CASINO_CHANNEL_ID = "1378822062558416966";

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
const mots = ["chat", "chien", "voiture", "ordinateur", "soleil", "lune", "fromage"];
const parties = new Map();

function formatMot(mot, lettresTrouvees) {
  return mot.split("").map(l => (lettresTrouvees.includes(l) ? l : "_")).join(" ");
}

function dessinerPendu(erreurs) {
  const etapes = [
    `\n+---+\n|   |\n    |\n    |\n    |\n    |\n=========\n`,
    `\n+---+\n|   |\nO   |\n    |\n    |\n    |\n=========\n`,
    `\n+---+\n|   |\nO   |\n|   |\n    |\n    |\n=========\n`,
    `\n+---+\n|   |\nO   |\n/|  |\n    |\n    |\n=========\n`,
    `\n+---+\n|   |\nO   |\n/|\\ |\n    |\n    |\n=========\n`,
    `\n+---+\n|   |\nO   |\n/|\\ |\n/   |\n    |\n=========\n`,
    `\n+---+\n|   |\nO   |\n/|\\ |\n/ \\ |\n    |\n=========\n`,
  ];
  return etapes[erreurs];
}

function envoyerBoutonPendu(channel) {
  const bouton = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("start_pendu").setLabel("🎮 Rejouer au pendu 🪢").setStyle(ButtonStyle.Success)
  );
  return channel.send({ content: "La partie est terminée ! Cliquez pour rejouer :", components: [bouton] });
}

// === CASINO ===
const userBalances = new Map();
const lastResultMessages = new Map();
let casinoMessageId = null;

const rouletteOptions = [
  { id: "bet_red", label: "Rouge" },
  { id: "bet_black", label: "Noir" },
  { id: "bet_number", label: "Numéro" },
  { id: "reset_money", label: "🔁 Reset solde" },
];

function getRouletteButtons() {
  return new ActionRowBuilder().addComponents(
    rouletteOptions.map(opt => new ButtonBuilder().setCustomId(opt.id).setLabel(opt.label).setStyle(ButtonStyle.Primary))
  );
}

function lancerRoulette(choice, amount, userNumber = null) {
  const number = Math.floor(Math.random() * 37);
  const color = number === 0 ? "green" : number % 2 === 0 ? "black" : "red";
  let gain = 0;
  if (choice === "red" && color === "red") gain = amount * 2;
  else if (choice === "black" && color === "black") gain = amount * 2;
  else if (choice === "number" && number === userNumber) gain = amount * 36;
  return { number, color, gain };
}

async function envoyerMessageCasino(channel) {
  const msg = await channel.send({
    content: "🎰 Bienvenue au **Casino** ! Choisissez une mise :",
    components: [getRouletteButtons()],
  });
  casinoMessageId = msg.id;
}

// === READY ===
client.once("ready", async () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);

  const signalChannel = await client.channels.fetch(SIGNAL_CHANNEL_ID);
  if (signalChannel) {
    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("open_report_modal").setLabel("📋 Signaler quelqu’un").setStyle(ButtonStyle.Primary)
    );
    await signalChannel.send({ content: "Signalez un comportement inapproprié :", components: [button] });
  }

  const penduChannel = await client.channels.fetch(CHANNEL_ID);
  if (penduChannel) {
    await envoyerBoutonPendu(penduChannel);
  }
});

// === COMMANDES ===
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.channel.id === CHANNEL_ID) {
    try {
      await message.react("✅");
      await message.react("❌");
    } catch (err) {
      console.error("❌ Erreur réactions :", err);
    }
  }

  if (message.content === "!pendu") {
    const mot = mots[Math.floor(Math.random() * mots.length)];
    parties.set(message.channel.id, { mot, lettresTrouvees: [], lettresProposees: [], erreurs: 0 });
    return message.channel.send(
      `🎮 **NOUVELLE PARTIE DU PENDU**\nMot : \`${formatMot(mot, [])}\`\n${dessinerPendu(0)}\n_Proposez une lettre !_`
    );
  }

  if (message.content.toLowerCase() === "cancel") {
    if (parties.has(message.channel.id)) {
      parties.delete(message.channel.id);
      return message.channel.send("❌ Partie annulée.");
    }
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
        await message.channel.send(`✅ Bravo ! Le mot était \`${partie.mot}\``);
        return envoyerBoutonPendu(message.channel);
      }
      return message.channel.send(`✅ Bonne lettre !\nMot : \`${motFormate}\`\n${dessinerPendu(partie.erreurs)}`);
    } else {
      partie.erreurs++;
      if (partie.erreurs >= 6) {
        parties.delete(message.channel.id);
        await message.channel.send(`💀 Perdu ! Le mot était \`${partie.mot}\`\n${dessinerPendu(partie.erreurs)}`);
        return envoyerBoutonPendu(message.channel);
      }
      return message.channel.send(`❌ Mauvaise lettre !\nMot : \`${formatMot(partie.mot, partie.lettresTrouvees)}\`\n${dessinerPendu(partie.erreurs)}`);
    }
  }

  if (["!casino", "!roulette"].includes(message.content)) {
    if (message.channel.id !== CASINO_CHANNEL_ID) {
      return message.reply("⛔ Utilise cette commande dans le salon dédié au casino.");
    }
    const balance = userBalances.get(message.author.id) ?? 10000;
    userBalances.set(message.author.id, balance);
    await message.channel.send(`🎰 **Solde actuel pour <@${message.author.id}> :** $${balance}`);
    return envoyerMessageCasino(message.channel);
  }
});

// === INTERACTIONS ===
client.on(Events.InteractionCreate, async (interaction) => {
  const userId = interaction.user.id;

  if (interaction.isButton() && interaction.customId === "open_report_modal") {
    const modal = new ModalBuilder().setCustomId("report_form").setTitle("🚨 Fiche de signalement");
    const inputs = [
      new TextInputBuilder().setCustomId("accuse").setLabel("Nom de l’accusé (@...)").setStyle(TextInputStyle.Short).setRequired(true),
      new TextInputBuilder().setCustomId("crimes").setLabel("Crimes reprochés").setStyle(TextInputStyle.Short).setRequired(true),
      new TextInputBuilder().setCustomId("contexte").setLabel("Contexte du drame").setStyle(TextInputStyle.Paragraph).setRequired(true),
      new TextInputBuilder().setCustomId("preuves").setLabel("Preuves (liens, screens...)\n(optionnel)").setStyle(TextInputStyle.Paragraph).setRequired(false),
    ];
    modal.addComponents(...inputs.map(input => new ActionRowBuilder().addComponents(input)));
    return interaction.showModal(modal);
  }

  if (interaction.isButton()) {
    const id = interaction.customId;

    if (id === "start_pendu") {
      await interaction.deferUpdate();
      try { await interaction.message.delete(); } catch {}
      const mot = mots[Math.floor(Math.random() * mots.length)];
      parties.set(interaction.channel.id, { mot, lettresTrouvees: [], lettresProposees: [], erreurs: 0 });
      return interaction.channel.send(`🎮 **NOUVELLE PARTIE DU PENDU**\nMot : \`${formatMot(mot, [])}\`\n${dessinerPendu(0)}\n_Proposez une lettre !_`);
    }

    if (!interaction.channel || interaction.channel.id !== CASINO_CHANNEL_ID) {
      return interaction.reply({ content: "⛔ Ce bouton ne peut être utilisé que dans le salon casino.", ephemeral: true });
    }

    if (id === "reset_money") {
      userBalances.set(userId, 10000);
      return interaction.reply({ content: "🔁 Votre solde a été réinitialisé à $10000.", ephemeral: true });
    }

    const modal = new ModalBuilder().setCustomId(`modal_${id}`).setTitle("🎰 Mise en jeu");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("amount").setLabel("💸 Somme à miser").setStyle(TextInputStyle.Short).setRequired(true)
      )
    );
    if (id === "bet_number") {
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
    if (isNaN(amount) || amount <= 0) {
      return interaction.reply({ content: "❌ Montant invalide.", ephemeral: true });
    }
    const balance = userBalances.get(userId) ?? 10000;
    if (balance < amount) {
      return interaction.reply({ content: "💸 Vous n'avez pas assez d'argent.", ephemeral: true });
    }

    let result;
    if (type === "bet_red") result = lancerRoulette("red", amount);
    else if (type === "bet_black") result = lancerRoulette("black", amount);
    else if (type === "bet_number") {
      const chosenNumber = parseInt(interaction.fields.getTextInputValue("number"));
      if (isNaN(chosenNumber) || chosenNumber < 0 || chosenNumber > 36) {
        return interaction.reply({ content: "❌ Numéro invalide.", ephemeral: true });
      }
      result = lancerRoulette("number", amount, chosenNumber);
    }

    const newBalance = balance - amount + result.gain;
    userBalances.set(userId, newBalance);

    const prev = lastResultMessages.get(userId);
    if (prev) {
      try {
        const msg = await interaction.channel.messages.fetch(prev);
        await msg.delete();
      } catch {}
    }

    const reply = await interaction.reply({
      content: `🎲 Résultat : numéro **${result.number}** (${result.color})\n💰 Gain : **$${result.gain}**\n💼 Nouveau solde : **$${newBalance}**`,
      ephemeral: false
    });
    lastResultMessages.set(userId, reply.id);
  }

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
});

client.login(process.env.TOKEN);
