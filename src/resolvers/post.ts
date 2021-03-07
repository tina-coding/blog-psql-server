import { Arg, Ctx, Mutation, Query, Resolver } from "type-graphql";

import { Post } from './../entities/Post';

import { MyContext } from './../types';


@Resolver()
export class PostResolver {
	/**
	 * Posts: Lists all posts
	 * @param no params
	 * @returns Array of post objects
	 */
	@Query(() => [Post])
	posts(@Ctx() { em }: MyContext): Promise<Post[]> {
		return em.find(Post, {});
	}

   /**
		* Post: Find one post by id
		* @param id int, the id of the post
		* @param param1
		* @returns Post or null
		*/

	// nullable true says we can return null, in this case we can return either a Post or null
	// explicit typing: @Arg('id', () => Int) id: number
	@Query(() => Post, { nullable: true })
	post(
		@Arg('id') id:number,
		@Ctx() { em }: MyContext): Promise<Post | null> {
		return em.findOne(Post, { id });
	}

	/**
	 * Creates a post with title and returns the created post
	 * @param title string, The name of the post
	 * @param no params
	 * @returns Post object, the created post
	 */
	@Mutation(() => Post)
	async createPost(
		@Arg('title') title: string,
		@Ctx() { em }: MyContext): Promise<Post> {
		const post = em.create(Post, { title });
		await em.persistAndFlush(post);

		return post;
	}

	@Mutation(() => Post, { nullable: true })
	async updatePost(
		@Arg('id') id: number,
		@Arg('title', () => String, { nullable: true }) title: string,
		@Ctx() { em }: MyContext): Promise<Post | null> {
		const post = await em.findOne(Post, { id }); // fetch the post
		if (!post) {
			// if can't find post
			return null;
		}

		if (typeof title !== 'undefined') {
			post.title = title;
			await em.persistAndFlush(post);
		}

		return post;
	}

	@Mutation(() => Boolean)
	async deletePostById(
		@Arg('id') id: number,
		@Ctx() { em }: MyContext): Promise<boolean> {
		await em.nativeDelete(Post, { id });
		return true;
	}
}