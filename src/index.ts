import { ApolloServer } from "apollo-server-express";
import connectRedis from "connect-redis";
import cors from "cors";
import "dotenv-safe/config";
import express from "express";
import session from "express-session";
import Redis from "ioredis";
import path from "path";
import "reflect-metadata";
import { buildSchema } from "type-graphql";
import { createConnection } from "typeorm";
// Constants
import { COOKIE_NAME, __prod__ } from "./constants";
// Entities
import { Clap } from "./entities/Clap";
import { Post } from "./entities/Post";
import { User } from "./entities/User";
// Loaders
import { createClapLoader } from "./loaders/clapLoader";
import { createUserLoader } from "./loaders/userLoader";
// Resolvers
import { ClapResolver } from "./resolvers/clap";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";

// order matters with express middleware if one depends on the other the independent middleware
// should be declared after the middleware it depends on
// in this case our apolloServer will need the redis client so redis needs to be defined first
// set request.credentials in /graphql settings from "omit" to "include"
const main = async () => {
  const connection = await createConnection({
    type: "postgres",
    url: process.env.DATABASE_URL,
    logging: true,
    // synchronize: true,
    migrations: [path.join(__dirname, "./migrations/*")],
    entities: [Post, User, Clap]
  });

  await connection.runMigrations();

  const app = express(); // initialize express app

  app.set("proxy", 1);

  const RedisStore = connectRedis(session);
  const redis = new Redis(process.env.REDIS_URL);

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN,
      credentials: true
    })
  );

  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({ client: redis, disableTouch: true }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
        httpOnly: true, // can't access cookie on client side
        sameSite: "lax", // csrf
        secure: __prod__, // cookie only works in https, set to prod
        domain: __prod__ ? ".codeimposter.wtf" : undefined
      },
      saveUninitialized: false, // don't allow saving empty data
      secret: process.env.SECRET,
      resave: false
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [ClapResolver, HelloResolver, PostResolver, UserResolver],
      validate: false
    }),
    context: ({ req, res }) => ({ req, res, redis, userLoader: createUserLoader(), clapLoader: createClapLoader() }) // object available throughout app
  });

  apolloServer.applyMiddleware({
    app,
    cors: false
  }); // creates graphql endpoint on express

  app.listen(parseInt(process.env.PORT), () =>
    console.log(`Server listening on port ${parseInt(process.env.PORT)} ...`)
  );
};

main();
