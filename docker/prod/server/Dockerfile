FROM node:22.16

ARG APP_DIST=""
ARG TZ="America/New_York"

ENV NODE_ENV=production
ENV NODE_OPTIONS=--enable-source-maps

ENV TZ=${TZ}
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

USER node
WORKDIR /home/node

COPY --chown=node:node ./${APP_DIST} /home/node
RUN chmod -R u=rwx /home/node
RUN NODE_ENV=production npm --omit=dev --force install

CMD ["node", "main.js"]