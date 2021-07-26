# LovecraftBot

Un bot Discord pour Horreur à Arkham : le Jeu de Cartes.

## Développement

- `npm run start:dev` pour démarrer en mode développement
- `npm run start` pour démarrer en mode production

## Variables d'environnement

Mettez les variables suivantes dans un fichier [`.env`](https://www.npmjs.com/package/dotenv).

### Obligatoire

- `DISCORD_TOKEN` - Le token Discord pour le bot.
- `CARD_OF_THE_DAY_CHANNEL` - L'ID du channel sur lequel envoyer la carte du jour
- `CARD_OF_THE_DAY_HOUR` - L'heure à laquelle envoyer la carte du jour (par défaut à `8`)

### Facultatif

- `COMMAND_PREFIX` - Le préfixe de commande du bot. Par défaut à `!`.
- `IGNORE_PRESENCE` - Ne pas pas positionner de texte de présence.
- `TEST_SERVER` - Mettre un ID de Guile Discord.
