import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import express from 'express';
import { MikroORM } from "@mikro-orm/core";

// Config
import microConfig from './mikro-orm.config';

// Resolvers
import { HelloResolver } from './resolvers/hello';

// Entities
import { Post } from './entities/Post';

// Constants
import { __prod__ } from "src/constants";

const main = async () => {
	const app = express(); // initialize express app

	const apolloServer = new ApolloServer({
		schema: await buildSchema({
			resolvers: [HelloResolver],
			validate: false
		})
	})
	const orm = await MikroORM.init(microConfig);
	orm.getMigrator().up(); // run migrations

	// creates an instance of post
	// const post = orm.em.create(Post, {
	// 	title: 'my first post '
	// });
	// await orm.em.persistAndFlush(post);


	// const posts = await orm.em.find(Post, {});
	// console.log({ posts });

	apolloServer.applyMiddleware({ app }); // creates graphql endpoint on express

	app.listen(4000, () => console.log("Server listening on port 4000..."));
}

main();