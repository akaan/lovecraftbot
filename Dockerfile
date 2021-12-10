FROM node:16.13

# Création du dossier
RUN mkdir -p /usr/src/bot
WORKDIR /usr/src/bot

# Copie et installation du bot
COPY ./package.json /usr/src/bot/
RUN npm install && npm cache clean --force

# Copie des sources
COPY ./ /usr/src/bot

# Démarrage !
CMD [ "npm", "start" ]
