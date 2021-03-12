import { Arg, Field, InputType, Mutation, Query, Resolver } from "type-graphql";
import { Post } from "./../entities/Post";


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

  /**
   * Creates a post with title and returns the created post
   * @param options object, title (string) required and description (string) optional param
   * @returns Post object, the created post
   */
  @Mutation(() => Post)
  async createPost(@Arg("options") options: CreatePostInput): Promise<Post> {
    const { title, description } = options;

    const body = description !== "" && description !== undefined ? { title, description } : { title };

    return Post.create(body).save();
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
}
