require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
 
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});
 
// --- Enregistrement automatique de la commande slash au démarrage ---
// (plus besoin de lancer un script à part en local)
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('creer-bouton')
      .setDescription('Crée un message avec un bouton qui révèle un lien en privé')
      .addStringOption(option =>
        option.setName('titre')
          .setDescription('Le titre affiché en haut du cadre')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('texte')
          .setDescription('Le texte du message affiché au-dessus du bouton')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('lien')
          .setDescription('Le lien à révéler quand on clique sur le bouton')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('label')
          .setDescription('Le texte affiché sur le bouton (par défaut: "Accès au lien")')
          .setRequired(false))
      .toJSON(),
  ];
 
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
 
  try {
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands },
      );
      console.log('✅ Commande /creer-bouton enregistrée sur le serveur (instantané).');
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );
      console.log('✅ Commande /creer-bouton enregistrée globalement (peut prendre jusqu\'à 1h).');
    }
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de la commande :', error);
  }
}
 
// --- Petite "base de données" locale (fichier JSON) ---
// On y stocke : id_du_bouton -> lien, pour pouvoir le retrouver
// même après un redémarrage du bot.
const DB_PATH = path.join(__dirname, 'data.json');
 
function loadDB() {
  if (!fs.existsSync(DB_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return {};
  }
}
 
function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
 
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
 
// --- Quand le bot est prêt ---
client.once('ready', async () => {
  console.log(`Connecté en tant que ${client.user.tag} ✅`);
  await registerCommands();
});
 
// --- Gestion des interactions (commande slash + clic sur bouton) ---
client.on('interactionCreate', async (interaction) => {
  // 1) La commande slash /creer-bouton
  if (interaction.isChatInputCommand() && interaction.commandName === 'creer-bouton') {
    const titre = interaction.options.getString('titre');
    const texte = interaction.options.getString('texte');
    const lien = interaction.options.getString('lien');
    const label = interaction.options.getString('label') || 'Accès au lien';
 
    const id = genId();
    const db = loadDB();
    db[id] = lien;
    saveDB(db);
 
    const bouton = new ButtonBuilder()
      .setCustomId(`showlink_${id}`)
      .setLabel(label)
      .setStyle(ButtonStyle.Primary);
 
    const row = new ActionRowBuilder().addComponents(bouton);
 
    const embed = new EmbedBuilder()
      .setTitle(titre)
      .setDescription(texte)
      .setColor(0x5865F2); // bleu Discord, change le code hexa si tu veux une autre couleur
 
    await interaction.reply({
      embeds: [embed],
      components: [row],
    });
  }
 
  // 2) Le clic sur le bouton "Accès au lien"
  if (interaction.isButton() && interaction.customId.startsWith('showlink_')) {
    const id = interaction.customId.replace('showlink_', '');
    const db = loadDB();
    const lien = db[id];
 
    if (!lien) {
      await interaction.reply({
        content: "❌ Ce lien n'est plus disponible.",
        ephemeral: true,
      });
      return;
    }
 
    // ephemeral: true => visible SEULEMENT par la personne qui a cliqué
    await interaction.reply({
      content: `🔗 Voici le lien : ${lien}`,
      ephemeral: true,
    });
  }
});
 
client.login(process.env.DISCORD_TOKEN);
