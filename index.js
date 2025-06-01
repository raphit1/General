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
  Events,
} = require("discord.js");
require("dotenv").config();

// === CONFIGURATION ===
const CHANNEL_ID = "1378448023625007287"; // Auto-réactions
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
  "téléphone", "crayon", "papier", "livre", "histoire", "clavier",
  "coussin", "camion", "train", "vélo", "guitare", "musique", "chanson"
];
const parties = new Map();

function formatMot(mot, lettresTrouvees) {
  return mot
    .split("")
    .map((l) => (lettresTrouvees.includes(l) ? l : "_"))
    .join(" ");
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
    content: "La partie est terminée ! Cliquez pour rejouer :",
    components: [bouton],
  });
}

// === ROULETTE ===
const userBalances = new Map();
let lastRouletteMessage = new Map();

const rouletteOptions = [
  { id: "bet_red", label: "Rouge" },
  { id: "bet_black", label: "Noir" },
  { id: "bet_number", label: "Numéro (0-36)" },
  { id: "reset_money", label: "🔁 Reset solde" },
];

async function envoyerBoutonRoulette(channel, userId = null) {
  const balance = userBalances.get(userId) ?? 10000;
  const row = new ActionRowBuilder().addComponents(
    rouletteOptions.map((opt) =>
      new ButtonBuilder()
        .setCustomId(opt.id)
        .setLabel(opt.label)
        .setStyle(ButtonStyle.Primary)
    )
  );
  const embed = new EmbedBuilder()
    .setTitle("🎰 Roulette Européenne")
    .setDescription(`Votre solde : **$${balance}**\nSélectionnez une mise via les boutons.`)
    .setColor(0x00ff00);

  const sent = await channel.send({ content: "", embeds: [embed], components: [row] });
  lastRouletteMessage.set(channel.id, sent);
}

function lancerRoulette(choice, amount, selectedNumber = null) {
  const number = Math.floor(Math.random() * 37);
  const color = number === 0 ? "green" : number % 2 === 0 ? "black" : "red";
  let gain = 0;

  if (choice === "red" && color === "red") gain = amount * 2;
  else if (choice === "black" && color === "black") gain = amount * 2;
  else if (choice === "number" && number === selectedNumber) gain = amount * 36;
  return { number, color, gain };
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
      content: "Signalez un comportement inapproprié :",
      components: [button],
    });
  }

  const channel = await client.channels.fetch(PENDU_BUTTON_CHANNEL_ID);
  if (channel) {
    await envoyerBoutonPendu(channel);
    await envoyerBoutonRoulette(channel);
  }
});

// === MESSAGE CREATE ===
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase().trim();

  if (message.channel.id === CHANNEL_ID) {
    try {
      await message.react("✅");
      await message.react("❌");
    } catch (err) {
      console.error("❌ Erreur réactions :", err);
    }
  }

  if (content === "!pendu") {
    if (parties.has(message.channel.id)) return message.reply("❗ Une partie est déjà en cours !");
    const mot = mots[Math.floor(Math.random() * mots.length)];
    parties.set(message.channel.id, { mot, lettresTrouvees: [], lettresProposees: [], erreurs: 0 });
    return message.channel.send(`🎮 **NOUVELLE PARTIE DU PENDU**\nMot : \`${formatMot(mot, [])}\`\n${dessinerPendu(0)}\n_Proposez une lettre !_`);
  }

  if (content === "cancel" || content === "stop") {
    if (parties.has(message.channel.id)) {
      parties.delete(message.channel.id);
      await message.channel.send("🛑 Partie du pendu annulée.");
      return envoyerBoutonPendu(message.channel);
    } else return message.reply("⚠️ Aucune partie en cours.");
  }

  if (content === "!roulette" || content === "!casino") {
    return envoyerBoutonRoulette(message.channel, message.author.id);
  }

  const partie = parties.get(message.channel.id);
  if (partie && content.length === 1 && /^[a-zA-Z]$/.test(content)) {
    try { await message.delete(); } catch {}
    const lettre = content.toLowerCase();
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
