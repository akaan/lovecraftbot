# LovecraftBot

Un bot Discord pour Horreur à Arkham : le Jeu de Cartes.

## Remerciements

- les données des cartes sont issues de [ArkhamDB](https://arkhamdb.com/) grâce au travail de [Kamalisk](https://github.com/Kamalisk) et [tant d'autres](https://github.com/Kamalisk/arkhamdb-json-data/graphs/contributors)
- les règles sont reprises du code source de [ArkhamCards](https://arkhamcards.com/) par [zzorba](https://github.com/zzorba)

## Développement

- `npm run start:dev` pour démarrer en mode développement
- `npm run start` pour démarrer en mode production

En mode développement, les commandes d'application sont déployées au niveau du
serveur (car le déploiement en plus rapide).
En mode production, seules certaines commandes sont déployées au niveau des
seveurs, le reste des commandes étant déployées globalement (avec un temps de
propagation côté Discord pouvant allez jusqu'à 1H).

## Variables d'environnement

Mettez les variables suivantes dans un fichier [`.env`](https://www.npmjs.com/package/dotenv).

### Obligatoire

- `DISCORD_TOKEN` - Le token Discord pour le bot.
- `CARD_OF_THE_DAY_CHANNEL` - L'ID du channel sur lequel envoyer la carte du jour
- `CARD_OF_THE_DAY_HOUR` - L'heure à laquelle envoyer la carte du jour (par défaut à `8`)
- `MASS_MULTIPLAYER_EVENT_CATEGORY` - Le nom de la catégorie de canaux pour l'organisation d'événements multijoueurs
- `MASS_MULTIPLAYER_EVENT_ADMIN_CHANNEL` - Le nom du canal utilisé pour les organisateurs d'un événement multijoueurs
- `BOT_ADMIN_ROLE` - Le nom du rôle autorisant l'accès aux commandes "admin" du bot

### Facultatif

- `COMMAND_PREFIX` - Le préfixe de commande du bot. Par défaut à `!`.
- `IGNORE_PRESENCE` - Ne pas pas positionner de texte de présence.
