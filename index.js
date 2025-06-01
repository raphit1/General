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
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, EmbedBuilder } = require('discord.js');

const GAME_CHANNEL_ID = '1378737038261620806';

// Variable pour stocker l'état des parties actives par messageID
const games = new Map();

// Fonction pour générer les boutons du plateau en fonction du tableau de jeu
function generateBoard(board) {
  const rows = [];
  for (let i = 0; i < 3; i++) {
    const actionRow = new ActionRowBuilder();
    for (let j = 0; j < 3; j++) {
      const index = i * 3 + j;
      const mark = board[index] || '⬜'; // Case vide
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`ttt_${index}`)
          .setLabel(mark === '⬜' ? ' ' : mark)
          .setStyle(mark === 'X' ? ButtonStyle.Danger : (mark === 'O' ? ButtonStyle.Primary : ButtonStyle.Secondary))
          .setDisabled(mark !== '⬜') // Désactive les cases prises
      );
    }
    rows.push(actionRow);
  }
  return rows;
}

// Fonction pour vérifier victoire ou nul
function checkWin(board) {
  const winPatterns = [
    [0,1,2],[3,4,5],[6,7,8], // lignes
    [0,3,6],[1,4,7],[2,5,8], // colonnes
    [0,4,8],[2,4,6]          // diagonales
  ];
  for (const pattern of winPatterns) {
    const [a,b,c] = pattern;
    if (board[a] && board[a] === board[b] && board[b] === board[c]) return board[a];
  }
  if (board.every(cell => cell)) return 'tie';
  return null;
}

// Au lancement, envoie message de départ
client.once('ready', async () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);

  const gameChannel = await client.channels.fetch(GAME_CHANNEL_ID);
  if (gameChannel) {
    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('start_tictactoe')
        .setLabel('▶️ Jouer au 3O ou 3X')
        .setStyle(ButtonStyle.Primary)
    );

    await gameChannel.send({
      content: 'Envie de jouer au 3O ou 3X ? Clique sur le bouton pour commencer une partie !',
      components: [button],
    });
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    // Démarrage de partie
    if (interaction.customId === 'start_tictactoe') {
      // Evite plusieurs parties sur le même message
      if ([...games.values()].some(g => g.status === 'playing')) {
        await interaction.reply({ content: "Une partie est déjà en cours, attends qu'elle se termine.", ephemeral: true });
        return;
      }

      // Init partie
      const board = Array(9).fill(null);
      const playerX = interaction.user.id;
      // On attend le joueur O
      const msg = await interaction.reply({
        content: `<@${playerX}> a commencé une partie de 3O ou 3X ! En attente d'un adversaire pour jouer avec 🟢`,
        components: generateBoard(board),
        fetchReply: true,
        ephemeral: false
      });

      games.set(msg.id, {
        board,
        playerX,
        playerO: null,
        turn: 'X', // X commence
        message: msg,
        status: 'waiting',
      });
      return;
    }

    // Si interaction sur un bouton de plateau de jeu
    if (interaction.customId.startsWith('ttt_')) {
      const msgId = interaction.message.id;
      const game = games.get(msgId);
      if (!game) {
        await interaction.reply({ content: "Cette partie n'existe plus.", ephemeral: true });
        return;
      }

      const userId = interaction.user.id;
      // Si on est en attente d'adversaire
      if (game.status === 'waiting') {
        if (userId === game.playerX) {
          await interaction.reply({ content: "Tu ne peux pas jouer tout seul 😅 Attends quelqu'un d'autre.", ephemeral: true });
          return;
        }
        // On accepte le joueur O
        game.playerO = userId;
        game.status = 'playing';
        await interaction.update({
          content: `<@${game.playerX}> (X) VS <@${game.playerO}> (O) - Au tour de <@${game.playerX}> (X)`,
          components: generateBoard(game.board),
        });
        return;
      }

      // Partie en cours : check si joueur valide
      if (userId !== game.playerX && userId !== game.playerO) {
        await interaction.reply({ content: "Tu ne joues pas dans cette partie.", ephemeral: true });
        return;
      }

      // Vérifier si c'est le tour du joueur
      const currentPlayerId = game.turn === 'X' ? game.playerX : game.playerO;
      if (userId !== currentPlayerId) {
        await interaction.reply({ content: "Ce n'est pas ton tour.", ephemeral: true });
        return;
      }

      // Récupérer la case choisie
      const index = parseInt(interaction.customId.split('_')[1]);
      if (game.board[index]) {
        await interaction.reply({ content: "Cette case est déjà prise.", ephemeral: true });
        return;
      }

      // Met à jour le plateau
      game.board[index] = game.turn;

      // Vérifie victoire ou nul
      const result = checkWin(game.board);

      if (result === 'X' || result === 'O') {
        // Fin de partie victoire
        const winnerId = result === 'X' ? game.playerX : game.playerO;
        const embed = new EmbedBuilder()
          .setTitle('🎉 Partie terminée !')
          .setDescription(`Félicitations <@${winnerId}> ! Tu as gagné avec le symbole ${result}`)
          .setColor(0x00FF00);

        await interaction.update({
          content: `<@${game.playerX}> (X) VS <@${game.playerO}> (O) - Partie terminée`,
          components: generateBoard(game.board),
          embeds: [embed],
        });
        games.delete(msgId);
        return;
      }

      if (result === 'tie') {
        // Fin de partie nul
        const embed = new EmbedBuilder()
          .setTitle('🤝 Match nul !')
          .setDescription(`La partie s'est terminée sans vainqueur.`)
          .setColor(0xFFFF00);

        await interaction.update({
          content: `<@${game.playerX}> (X) VS <@${game.playerO}> (O) - Partie terminée`,
          components: generateBoard(game.board),
          embeds: [embed],
        });
        games.delete(msgId);
        return;
      }

      // Change de tour
      game.turn = game.turn === 'X' ? 'O' : 'X';

      // Mise à jour message
      await interaction.update({
        content: `<@${game.playerX}> (X) VS <@${game.playerO}> (O) - Au tour de <@${game.turn === 'X' ? game.playerX : game.playerO}> (${game.turn})`,
        components: generateBoard(game.board),
      });
    }
  }
});
client.login(process.env.TOKEN);
