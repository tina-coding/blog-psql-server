import { Post } from "./Post";
import { Field, ObjectType } from "type-graphql";
import { BaseEntity, Column, Entity, ManyToOne, PrimaryColumn } from "typeorm";
import { User } from "./User";
import { Min, Max, IsInt } from "class-validator";
// many to many: m to n
// several users can clap on many posts
// a user can clap on many posts
// user -> join table <- posts

@ObjectType()
@Entity()
export class Clap extends BaseEntity {
  @Field()
  @IsInt()
  @Min(0)
  @Max(1)
  @Column({ type: "int" })
  value: number;

  @Field()
  @PrimaryColumn()
  userId: number;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.claps)
  user: User;

  @Field()
  @PrimaryColumn()
  postId: number;

  @Field(() => Post)
  @ManyToOne(() => Post, (post) => post.claps, {
    onDelete: "CASCADE"
  })
  post: Post;
}
