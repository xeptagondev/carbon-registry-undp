FROM node:20-alpine

WORKDIR /usr/src/app

COPY ./backend-hedera/custodian/package.json \
     ./backend-hedera/custodian/yarn.lock   ./

RUN yarn install --frozen-lockfile

RUN yarn add -D concurrently@8.2.2

COPY ./backend-hedera/custodian/libs/shared/src/templates \
     ./libs/shared/src/templates
COPY ./backend-hedera/custodian/libs/shared/src/i18n \
     ./libs/shared/src/i18n

COPY ./backend-hedera/custodian .

RUN yarn build:all
