FROM node:20-alpine

# Set the working directory
WORKDIR /usr/src/app

COPY ./backend-hedera/custodian/package.json ./backend-hedera/custodian/yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Ensure concurrently is installed
RUN yarn add concurrently@8.2.2

# Copy the application source code
COPY ./backend-hedera/custodian ./

# Build the application
RUN yarn build:all