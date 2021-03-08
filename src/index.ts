import { ApolloServer } from 'apollo-server-express';
import connectRedis from 'connect-redis';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import { MikroORM } from '@mikro-orm/core';
import redis from 'redis';
import 'reflect-metadata';
import { buildSchema } from 'type-graphql';


// Config
import microConfig from './mikro-orm.config';

// Resolvers
import { HelloResolver } from './resolvers/hello';
import { PostResolver } from './resolvers/post';
import { UserResolver } from './resolvers/user';

// Constants
import { __prod__, COOKIE_NAME } from './constants';

// order matters with express middleware if one depends on the other the independent middleware
// should be declared after the middleware it depends on
// in this case our apolloServer will need the redis client so redis needs to be defined first
// set request.credentials in /graphql settings from "omit" to "include"
const main = async () => {
  const app = express(); // initialize express app

  const RedisStore = connectRedis(session);
  const redisClient = redis.createClient();

	app.use(
		cors({
			origin: 'http://localhost:3000',
			credentials: true
		})
	);

  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({ client: redisClient, disableTouch: true }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
        httpOnly: true, // can't access cookie on client side
        sameSite: 'lax', // csrf
        secure: __prod__ // cookie only works in https, set to prod
      },
      saveUninitialized: false, // don't allow saving empty data
      secret: 'lakjdflakjrlejkaldfldkmlcldkfjalefr',
      resave: false
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false
    }),
    context: ({ req, res }) => ({ em: orm.em, req, res }) // object available throughout app
  });
  const orm = await MikroORM.init(microConfig);
  orm.getMigrator().up(); // run migrations

  apolloServer.applyMiddleware({
    app,
		cors: false
  }); // creates graphql endpoint on express

  app.listen(4000, () => console.log('Server listening on port 4000...'));
};

main();
