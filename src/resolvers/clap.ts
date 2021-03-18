import { isAuth } from "../middleware/isAuth";
import { Arg, Ctx, Field, InputType, Int, Mutation, Resolver, UseMiddleware } from "type-graphql";
import { getConnection } from "typeorm";
import { Clap } from "../entities/Clap";
import { MyContext } from "./../types";

@InputType()
class VoteInput {
  @Field(() => Int)
  postId: number;

  @Field(() => Int)
  value: number;
}

@Resolver()
export class ClapResolver {
  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async voteOnPost(@Arg("options") options: VoteInput, @Ctx() { req }: MyContext): Promise<boolean> {
    const { postId, value: inputValue } = options;
    const { userId } = req.session;

    const isUpvote = inputValue === 1;
    const value = isUpvote ? 1 : -1;

    const existingVote = await Clap.findOne({ where: { postId, userId } });

    if (existingVote && existingVote.value !== value) {
      // user has voted already
      // update the clap table and post rather than insert
      await getConnection().transaction(async (transactionManager) => {
        await transactionManager.query(
          `
        UPDATE clap
        SET value = $1
        WHERE "postId" = $2 AND "userId" = $3

        `,
          [value, postId, userId]
        );

        await transactionManager.query(
          `
        UPDATE post
        SET votes = votes + $1
        WHERE id = $2
        AND votes + $1 >= 0;
        `,
          [value, postId]
        );
      });
    } else if (!existingVote) {
      // user is creating new vote

      // create a new transaction to increment the votes and update
      // the votes on the post
      // the transaction function on getConnection will handle errors
      // from either query and handle the start and commit
      await getConnection().transaction(async (transactionManager) => {
        await transactionManager.query(
          `
        INSERT INTO clap ("userId", "postId", value)
        values ($1, $2, $3);

        `,
          [userId, postId, value]
        );

        await transactionManager.query(
          `
        UPDATE post
        SET votes = votes + $1
        WHERE id = $2;
        `,
          [value, postId]
        );
      });
    }

    return true;
  }
}
