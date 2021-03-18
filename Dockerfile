FROM node:14

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json yarn.lock ./

RUN yarn install
# If you are building your code for production
# RUN yarn install --production

# Bundle app source
COPY . .
COPY .env.production .env

RUN yarn build

# Set node environement
ENV NODE_ENV production

EXPOSE 8080
CMD [ "node", "dist/index.js" ]

# Run as a non root user
USER node