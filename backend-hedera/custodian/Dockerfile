# Base image
FROM node:20-alpine
ARG SERVICE

# Create app directory
WORKDIR /usr/src/app

COPY ./backend-hedera/custodian/package.json .
COPY ./backend-hedera/custodian/yarn.lock .

# Install app dependencies
RUN yarn install
# Bundle app source 
COPY ./backend-hedera/custodian .

RUN yarn build