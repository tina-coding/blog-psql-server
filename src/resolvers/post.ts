import { User } from "./../entities/User";
import { getConnection } from "typeorm";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware
} from "type-graphql";
import { Min, Max } from "class-validator";
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
class PostPaginateInput {
  @Field(() => Int)
  @Min(1)
  @Max(30)
  limit: number;

  @Field(() => String, { nullable: true })
  cursor: string | null;
}

@InputType()
class UpdatePostInput {
  @Field(() => Int)
  id: number;

  @Field()
  title: string;

  @Field()
  description: string;
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

@ObjectType()
class PostPagination {
  @Field(() => [Post])
  posts: Post[];

  @Field(() => Int)
  total: number;
}
@Resolver(Post)
export class PostResolver {
  @FieldResolver(() => String)
  postDescSnippet(@Root() root: Post): string {
    // called every time we get a Post object
    return root.description.slice(0, 100);
  }

  @FieldResolver(() => User)
  async author(@Root() root: Post, @Ctx() { userLoader }: MyContext): Promise<User | undefined> {
    return userLoader.load(root.authorId);
  }

  @FieldResolver(() => Int, { nullable: true })
  async hasVoted(@Root() root: Post, @Ctx() { clapLoader, req }: MyContext): Promise<number | null> {
    if (!req.session.userId) {
      return null;
    }

    const clap = await clapLoader.load({ postId: root.id, userId: req.session.userId });

    return clap ? clap.value : null;
  }
  /**
   * Posts: Lists all posts
   * @param no params
   * @returns Array of post objects
   */
  @Query(() => PostPagination)
  async posts(@Arg("options") options: PostPaginateInput): Promise<PostPagination> {
    const limitCap = Math.min(options.limit, 30);

    const parameters: unknown[] = [limitCap];

    if (options.cursor) {
      parameters.push(new Date(parseInt(options.cursor)));
    }
    /*eslint quotes: ["off", "double"]*/
    /*eslint-env es6*/
    const posts = await getConnection().query(
      `
      SELECT p.*
      FROM post p
      ${options.cursor ? 'WHERE p."createdAt" < $2' : ""}
      ORDER BY p."createdAt" DESC
      LIMIT $1
    `,
      parameters
    );

    return { posts, total: posts.length };
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
  post(@Arg("id", () => Int) id: number): Promise<Post | undefined> {
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
  @UseMiddleware(isAuth)
  async updatePost(@Arg("options") options: UpdatePostInput, @Ctx() { req }: MyContext): Promise<Post | null> {
    const { id, title, description } = options;

    const result = await getConnection()
      .createQueryBuilder()
      .update(Post)
      .set({ title, description })
      .where('id = :id and "authorId" = :authorId', { id, authorId: req.session.userId })
      .returning("*")
      .execute();

    return result.raw[0]; // return null if the current user does not own post and updated post if the user does own it
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deletePostById(@Arg("id", () => Int) id: number, @Ctx() { req }: MyContext): Promise<boolean> {
    await Post.delete({ id, authorId: req.session.userId });
    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deletePosts(@Arg("options") options: DeletePostsInput): Promise<boolean> {
    await Post.delete(options.ids);
    return true;
  }
}
