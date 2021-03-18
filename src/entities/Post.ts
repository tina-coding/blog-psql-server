import { User } from "./User";
import { Field, Int, ObjectType } from "type-graphql";
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  UpdateDateColumn,
  OneToMany
} from "typeorm";
import { Clap } from "./Clap";
import { MinLength } from "class-validator";

@ObjectType()
@Entity()
export class Post extends BaseEntity {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id!: number;

  @Field()
  @Column()
  authorId: number;

  @Field()
  @ManyToOne(() => User, (user) => user.posts)
  author: User;

  @OneToMany(() => Clap, (clap) => clap.user)
  claps: Clap[];

  @Field(() => Int, { nullable: true })
  hasVoted: number | null;

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt: Date;

  @Field()
  @MinLength(3, { message: "Title is too short" })
  @Column()
  title!: string;

  @Field(() => String)
  @MinLength(3, { message: "Title is too short" })
  @Column()
  description!: string;

  @Field(() => Int)
  @Column({ type: "int", default: 0 })
  votes!: number;
}
