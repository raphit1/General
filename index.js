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

const CHANNEL_ID = "1378448023625007287";
const SIGNAL_CHANNEL_ID = "1378660736150011956";
const REPORT_CHANNEL_ID = "1378661323054776400";
const PENDU_BUTTON_CHANNEL_ID = "1378737038261620806";
const ROULETTE_BUTTON_CHANNEL_ID = "1378737038261620806";

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
  "chat", "chien", "voiture", "ordinateur", "soleil", "lune", "fromage",
  "bouteille", "maison", "fenetre", "pluie", "neige", "montagne", "rivière",
  "téléphone", "crayon", "papier", "livre", "histoire", "clavier", "coussin",
  "camion", "train", "vélo", "guitare", "musique", "chanson"
];
const parties = new Map();

function formatMot(mot, lettresTrouvees) {
  return mot.split("").map(l => (lettresTrouvees.includes(l) ? l : "_")).join(" ");
}

function dessinerPendu(erreurs) {
  const etapes = [
    "\n+---+\n|   |\n    |\n    |\n    |\n    |\n=========\n",
    "\n+---+\n|   |\nO   |\n    |\n    |\n    |\n=========\n",
    "\n+---+\n|   |\nO   |\n|   |\n    |\n    |\n=========\n",
    "\n+---+\n|   |\nO   |\n/|  |\n    |\n    |\n=========\n",
    "\n+---+\n|   |\nO   |\n/|\\ |\n    |\n    |\n=========\n",
    "\n+---+\n|   |\nO   |\n/|\\ |\n/   |\n    |\n=========\n",
    "\n+---+\n|   |\nO   |\n/|\\ |\n/ \\ |\n    |\n=========\n",
  ];
  return etapes[Math.min(erreurs, etapes.length - 1)];
}

async function envoyerBoutonPendu(channel) {
  const bouton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("start_pendu")
      .setLabel("🎮 Rejouer au pendu 🪢")
      .setStyle(ButtonStyle.Success)
  );
  await channel.send({ content: "La partie est terminée ! Cliquez pour rejouer :", components: [bouton] });
}

// === ROULETTE ===
const userBalances = new Map();

function getRouletteEmbed(balance) {
  return new EmbedBuilder()
    .setTitle("🎰 Roulette Européenne")
    .setDescription(`Votre solde : **$${balance}**\nSélectionnez une mise via les boutons.`)
    .setColor(0x00ff00);
}

const rouletteOptions = [
  { id: "bet_red", label: "Rouge", color: "Rouge" },
  { id: "bet_black", label: "Noir", color: "Noir" },
  { id: "bet_number", label: "Numéro (0-36)", color: "Numéro" },
  { id: "reset_money", label: "🔁 Reset solde", color: "Reset" },
];

async function envoyerBoutonRoulette(channel) {
  const row = new ActionRowBuilder().addComponents(
    rouletteOptions.map(opt =>
      new ButtonBuilder().setCustomId(opt.id).setLabel(opt.label).setStyle(ButtonStyle.Primary)
    )
  );
  await channel.send({ content: "Lancez une roulette !", components: [row] });
}

function lancerRoulette(choice, amount) {
  const number = Math.floor(Math.random() * 37);
  const color = number === 0 ? "green" : number % 2 === 0 ? "black" : "red";
  let gain = 0;

  if (choice === "red" && color === "red") gain = amount * 2;
  else if (choice === "black" && color === "black") gain = amount * 2;
  else if (choice === "number") gain = amount * 36;

  return { number, color, gain };
}

// === READY ===
client.once("ready", async () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);

  try {
    const signalChannel = await client.channels.fetch(SIGNAL_CHANNEL_ID);
    if (signalChannel) {
      const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("open_report_modal")
          .setLabel("📋 Signaler quelqu’un")
          .setStyle(ButtonStyle.Primary)
      );
      await signalChannel.send({ content: "Signalez un comportement inapproprié :", components: [button] });
    }

    const channel = await client.channels.fetch(PENDU_BUTTON_CHANNEL_ID);
    if (channel) {
      await envoyerBoutonPendu(channel);
      await envoyerBoutonRoulette(channel);
    }
  } catch (err) {
    console.error("❌ Erreur au démarrage :", err);
  }
});

// === MESSAGE ===
client.on("messageCreate", async (message) => {
  if (message.channel.id === CHANNEL_ID && !message.author.bot) {
    try {
      await message.react("✅");
      await message.react("❌");
    } catch (err) {
      console.error("❌ Erreur réactions :", err);
    }
  }

  // Pendu
  const partie = parties.get(message.channel.id);
  if (partie && !message.author.bot && message.content.length === 1 && /^[a-zA-Z]$/.test(message.content)) {
    try { await message.delete(); } catch (e) {}

    const lettre = message.content.toLowerCase();
    if (partie.lettresProposees.includes(lettre)) return;

    partie.lettresProposees.push(lettre);
    if (partie.mot.includes(lettre)) {
      partie.lettresTrouvees.push(lettre);
      const motFormate = formatMot(partie.mot, partie.lettresTrouvees);

      if (!motFormate.includes("_")) {
        await message.channel.send(`✅ Bravo ! Le mot était \`${partie.mot}\``);
        parties.delete(message.channel.id);
        return envoyerBoutonPendu(message.channel);
      } else {
        return message.channel.send(`✅ Bonne lettre !\nMot : \`${motFormate}\`\n${dessinerPendu(partie.erreurs)}`);
      }
    } else {
      partie.erreurs++;
      if (partie.erreurs >= 6) {
        await message.channel.send(`💀 Perdu ! Le mot était \`${partie.mot}\`\n${dessinerPendu(partie.erreurs)}`);
        parties.delete(message.channel.id);
        return envoyerBoutonPendu(message.channel);
      } else {
        return message.channel.send(`❌ Mauvaise lettre !\nMot : \`${formatMot(partie.mot, partie.lettresTrouvees)}\`\n${dessinerPendu(partie.erreurs)}`);
      }
    }
  }
});

// === INTERACTIONS ===
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    const id = interaction.customId;
    const userId = interaction.user.id;

    if (id === "open_report_modal") {
      const modal = new ModalBuilder().setCustomId("report_form").setTitle("🚨 Fiche de signalement");
      const inputs = [
        new TextInputBuilder().setCustomId("accuse").setLabel("Nom de l’accusé (@...)").setStyle(TextInputStyle.Short).setRequired(true),
        new TextInputBuilder().setCustomId("crimes").setLabel("Crimes reprochés").setStyle(TextInputStyle.Short).setRequired(true),
        new TextInputBuilder().setCustomId("contexte").setLabel("Contexte du drame").setStyle(TextInputStyle.Paragraph).setRequired(true),
        new TextInputBuilder().setCustomId("preuves").setLabel("Preuves (liens, screens...)").setStyle(TextInputStyle.Paragraph).setRequired(false),
      ];
      modal.addComponents(...inputs.map(input => new ActionRowBuilder().addComponents(input)));
      return await interaction.showModal(modal);
    }

    if (id === "start_pendu") {
      await interaction.deferUpdate();
      try { await interaction.message.delete(); } catch (e) {}
      const mot = mots[Math.floor(Math.random() * mots.length)];
      const lettresTrouvees = [];
      const lettresProposees = [];
      const erreurs = 0;
      parties.set(interaction.channel.id, { mot, lettresTrouvees, lettresProposees, erreurs });
      return await interaction.channel.send(`🎮 **NOUVELLE PARTIE DU PENDU**\nMot : \`${formatMot(mot, lettresTrouvees)}\`\n${dessinerPendu(erreurs)}\n_Proposez une lettre !_`);
    }

    if (id.startsWith("bet_")) {
      let balance = userBalances.get(userId) ?? 10000;
      const bet = 1000;
      if (balance < bet) return await interaction.reply({ content: "💸 Vous n'avez pas assez d'argent.", ephemeral: true });

      let result;
      if (id === "bet_red") result = lancerRoulette("red", bet);
      else if (id === "bet_black") result = lancerRoulette("black", bet);
      else if (id === "bet_number") result = lancerRoulette("number", bet);

      const newBalance = balance - bet + result.gain;
      userBalances.set(userId, newBalance);
      return await interaction.reply({
        content: `🎲 Résultat : numéro **${result.number}** (${result.color})\n💰 Gain : **$${result.gain}**\n💼 Nouveau solde : **$${newBalance}**`,
        ephemeral: true,
      });
    }

    if (id === "reset_money") {
      userBalances.set(userId, 10000);
      return await interaction.reply({ content: "🔁 Votre solde a été réinitialisé à $10000.", ephemeral: true });
    }
  }

  if (interaction.isModalSubmit() && interaction.customId === "report_form") {
    const getField = (id) => interaction.fields.getTextInputValue(id);
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
