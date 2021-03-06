import { Post } from './entities/Post';
import { MikroORM } from "@mikro-orm/core";
import { __prod__ } from "src/constants";
import microConfig from './mikro-orm.config';


const main = async () => {

	const orm = await MikroORM.init(microConfig);
	orm.getMigrator().up(); // run migrations

	// creates an instance of post
	const post = orm.em.create(Post, {
		title: 'my first post '
	});
	await orm.em.persistAndFlush(post);


	const posts = await orm.em.find(Post, {});
	console.log({ posts });
}

main();