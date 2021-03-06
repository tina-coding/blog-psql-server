import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import express from 'express';
import { MikroORM } from "@mikro-orm/core";
import 'reflect-metadata';

// Config
import microConfig from './mikro-orm.config';

// Resolvers
import { HelloResolver } from './resolvers/hello';
import { PostResolver } from './resolvers/post';

// Constants
import { __prod__ } from "src/constants";

const main = async () => {
	const app = express(); // initialize express app

	const apolloServer = new ApolloServer({
		schema: await buildSchema({
			resolvers: [HelloResolver, PostResolver],
			validate: false
		}),
		context: () => ({ em: orm.em }) // object available throughout app
	})
	const orm = await MikroORM.init(microConfig);
	orm.getMigrator().up(); // run migrations

	apolloServer.applyMiddleware({ app }); // creates graphql endpoint on express

	app.listen(4000, () => console.log("Server listening on port 4000..."));
}

main();