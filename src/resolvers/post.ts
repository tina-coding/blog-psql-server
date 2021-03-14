import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Query, Resolver, UseMiddleware } from "type-graphql";
import { v4 } from "uuid";
import { TMP_POST_PREFIX } from "./../constants";
import { Post } from "./../entities/Post";
import { isAuth } from "./../middleware/isAuth";
import { MyContext } from "./../types";

@ObjectType()
class CachedPost {
  @Field()
  title: string;

  @Field()
  description: string;
}
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

@InputType()
class DeletePostsInput {
  @Field(() => [Number])
  ids: number[];
}

@Resolver()
export class PostResolver {
  /**
   * Posts: Lists all posts
   * @param no params
   * @returns Array of post objects
   */
  @Query(() => [Post])
  posts(): Promise<Post[]> {
    return Post.find();
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
  post(@Arg("id") id: number): Promise<Post | undefined> {
    return Post.findOne(id);
  }

  @Query(() => CachedPost)
  async cachedPost(@Arg("key") key: string, @Ctx() { redis }: MyContext): Promise<CachedPost> {
    const title = await redis.lrange(TMP_POST_PREFIX + key, 0, 0);

    const description = await redis.lrange(TMP_POST_PREFIX + key, 1, 1);

    return { title: title[0], description: description[0] };
  }

  @Mutation(() => Boolean)
  async clearPostCache(@Arg("key") key: string, @Ctx() { redis }: MyContext): Promise<boolean> {
    await redis.del(TMP_POST_PREFIX + key);
    return true;
  }

  @Mutation(() => String)
  async cachePost(@Arg("options") options: CreatePostInput, @Ctx() { redis }: MyContext): Promise<string> {
    const redisKey = v4();
    const { title, description } = options;

    await redis.rpush(TMP_POST_PREFIX + redisKey, [title, description]);

    return redisKey;
  }

  /**
   * Creates a post with title and returns the created post
   * @param options object, title (string) required and description (string) optional param
   * @returns Post object, the created post
   */
  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(@Arg("options") options: CreatePostInput, @Ctx() { req }: MyContext): Promise<Post> {
    const { title, description } = options;

    const body = description !== "" && description !== undefined ? { title, description } : { title };

    return Post.create({ ...body, authorId: req.session.userId }).save();
  }

  @Mutation(() => Post, { nullable: true })
  async updatePost(@Arg("options") options: UpdatePostInput): Promise<Post | null> {
    const { id, title, description } = options;
    const post = await Post.findOne(id); // fetch the post
    if (!post) {
      // if can't find post
      return null;
    }

    if (options.title && typeof options.title !== "undefined") {
      await Post.update({ id }, { title });
    }

    if (options.description && typeof options.description !== "undefined") {
      await Post.update({ id }, { description });
    }

    return post;
  }

  @Mutation(() => Boolean)
  async deletePostById(@Arg("id") id: number): Promise<boolean> {
    await Post.delete(id);
    return true;
  }

  @Mutation(() => Boolean)
  async deletePosts(@Arg("options") options: DeletePostsInput): Promise<boolean> {
    await Post.delete(options.ids);
    return true;
  }
}
