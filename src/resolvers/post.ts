import { Arg, Ctx, Field, InputType, Mutation, Query, Resolver } from "type-graphql";

import { Post } from "./../entities/Post";

import { MyContext } from "./../types";

@InputType()
class UpdatePostInput {
  @Field()
  id: number;

  @Field()
  title?: string;

  @Field()
  description?: string;
}

@InputType()
class CreatePostInput {
  @Field(() => String, { description: "Title for the post" })
  title: string;

  @Field(() => String, { description: "Description for the post, the content for the post.", nullable: true })
  description?: string;
}

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
  post(@Arg("id") id: number, @Ctx() { em }: MyContext): Promise<Post | null> {
    return em.findOne(Post, { id });
  }

  /**
   * Creates a post with title and returns the created post
   * @param options object, title (string) required and description (string) optional param
   * @returns Post object, the created post
   */
  @Mutation(() => Post)
  async createPost(@Arg("options") options: CreatePostInput, @Ctx() { em }: MyContext): Promise<Post> {
    const { title, description } = options;

    const body = description !== "" && description !== undefined ? { title, description } : { title };

    const post = em.create(Post, body);
    await em.persistAndFlush(post);

    return post;
  }

  @Mutation(() => Post, { nullable: true })
  async updatePost(@Arg("options") options: UpdatePostInput, @Ctx() { em }: MyContext): Promise<Post | null> {
    const post = await em.findOne(Post, { id: options.id }); // fetch the post
    if (!post) {
      // if can't find post
      return null;
    }

    if (options.title && typeof options.title !== "undefined") {
      post.title = options.title;
    }

    if (options.description && typeof options.description !== "undefined") {
      post.description = options.description;
    }

    await em.persistAndFlush(post);
    return post;
  }

  @Mutation(() => Boolean)
  async deletePostById(@Arg("id") id: number, @Ctx() { em }: MyContext): Promise<boolean> {
    await em.nativeDelete(Post, { id });
    return true;
  }
}
