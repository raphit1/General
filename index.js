// === IMPORTS ===
const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, Events } = require("discord.js");
require("dotenv").config();

// === CONFIGURATION ===
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
const mots = ["chat", "chien", "voiture", "ordinateur", "soleil", "lune", "fromage", "bouteille", "maison", "fenetre", "pluie", "neige", "montagne", "rivière", "téléphone", "crayon", "papier", "livre", "histoire", "clavier", "coussin", "camion", "train", "vélo", "guitare", "musique", "chanson"];
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
  return etapes[erreurs];
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
let rouletteMessage;

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

async function envoyerBoutonRoulette(channel, userId = null) {
  const row = new ActionRowBuilder().addComponents(
    rouletteOptions.map(opt =>
      new ButtonBuilder()
        .setCustomId(opt.id)
        .setLabel(opt.label)
        .setStyle(ButtonStyle.Primary)
    )
  );
  const balance = userBalances.get(userId) ?? 10000;
  const embed = getRouletteEmbed(balance);

  if (rouletteMessage) {
    await rouletteMessage.edit({ embeds: [embed], components: [row] });
  } else {
    rouletteMessage = await channel.send({ embeds: [embed], components: [row] });
  }
}

function lancerRoulette(choice, amount, chosenNumber = null) {
  const number = Math.floor(Math.random() * 37);
  const color = number === 0 ? "green" : number % 2 === 0 ? "black" : "red";
  let gain = 0;

  if (choice === "red" && color === "red") gain = amount * 2;
  else if (choice === "black" && color === "black") gain = amount * 2;
  else if (choice === "number" && number === chosenNumber) gain = amount * 36;

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
  if (message.channel.id === CHANNEL_ID && !message.author.bot) {
    try {
      await message.react("✅");
      await message.react("❌");
    } catch (err) {
      console.error("❌ Erreur réactions :", err);
    }
  }

  const partie = parties.get(message.channel.id);
  if (
    partie &&
    !message.author.bot &&
    message.content.length === 1 &&
    /^[a-zA-Z]$/.test(message.content)
  ) {
    try {
      await message.delete();
    } catch (e) {}
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
      partie.erreurs += 1;
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
  const id = interaction.customId;
  const userId = interaction.user.id;

  if (interaction.isButton()) {
    // Signalement
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

    // Pendu
    if (id === "start_pendu") {
      await interaction.deferUpdate();
      try { await interaction.message.delete(); } catch (e) {}
      const mot = mots[Math.floor(Math.random() * mots.length)];
      parties.set(interaction.channel.id, { mot, lettresTrouvees: [], lettresProposees: [], erreurs: 0 });
      return await interaction.channel.send(`🎮 **NOUVELLE PARTIE DU PENDU**\nMot : \`${formatMot(mot, [])}\`\n${dessinerPendu(0)}\n_Proposez une lettre !_`);
    }

    // Roulette
    if (["bet_red", "bet_black"].includes(id)) {
      const modal = new ModalBuilder().setCustomId(`${id}_modal`).setTitle("🎰 Mise sur la roulette");
      const input = new TextInputBuilder().setCustomId("amount").setLabel("Montant à miser").setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return await interaction.showModal(modal);
    }

    if (id === "bet_number") {
      const modal = new ModalBuilder().setCustomId("bet_number_modal").setTitle("🎯 Pari sur un numéro");
      const input1 = new TextInputBuilder().setCustomId("amount").setLabel("Montant à miser").setStyle(TextInputStyle.Short).setRequired(true);
      const input2 = new TextInputBuilder().setCustomId("number").setLabel("Numéro choisi (0-36)").setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(
        new ActionRowBuilder().addComponents(input1),
        new ActionRowBuilder().addComponents(input2)
      );
      return await interaction.showModal(modal);
    }

    if (id === "reset_money") {
      userBalances.set(userId, 10000);
      await interaction.reply({ content: "🔁 Votre solde a été réinitialisé à $10000.", ephemeral: true });
      return envoyerBoutonRoulette(interaction.channel, userId);
    }
  }

  // === MODAL: REPORT FORM ===
  if (interaction.isModalSubmit()) {
    if (interaction.customId === "report_form") {
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
      const reportChannel = await client.channels.fetch(REPORT_CHANNEL_ID).catch(() => {});
      if (reportChannel) await reportChannel.send({ embeds: [embed] });
    }

    if (interaction.customId.endsWith("_modal") || interaction.customId === "bet_number_modal") {
      const amount = parseInt(interaction.fields.getTextInputValue("amount"));
      if (isNaN(amount) || amount <= 0) return interaction.reply({ content: "⛔ Montant invalide.", ephemeral: true });

      const balance = userBalances.get(userId) ?? 10000;
      if (balance < amount) return interaction.reply({ content: "💸 Vous n'avez pas assez d'argent.", ephemeral: true });

      let result, gain = 0;

      if (interaction.customId === "bet_red_modal") result = lancerRoulette("red", amount);
      if (interaction.customId === "bet_black_modal") result = lancerRoulette("black", amount);
      if (interaction.customId === "bet_number_modal") {
        const chosen = parseInt(interaction.fields.getTextInputValue("number"));
        if (isNaN(chosen) || chosen < 0 || chosen > 36) return interaction.reply({ content: "⛔ Numéro invalide (0-36).", ephemeral: true });
        result = lancerRoulette("number", amount, chosen);
      }

      const newBalance = balance - amount + result.gain;
      userBalances.set(userId, newBalance);

      await interaction.reply({
        content: `🎲 Résultat : numéro **${result.number}** (${result.color})\n💰 Gain : **$${result.gain}**\n💼 Nouveau solde : **$${newBalance}**`,
        ephemeral: true,
      });

      return envoyerBoutonRoulette(interaction.channel, userId);
    }
  }
});

client.login(process.env.TOKEN);
