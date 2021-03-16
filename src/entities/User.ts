import { Clap } from "./Clap";
import { Field, Int, ObjectType } from "type-graphql";
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  UpdateDateColumn
} from "typeorm";
import { Post } from "./Post";
@ObjectType()
@Entity()
export class User extends BaseEntity {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];

  @OneToMany(() => Clap, (clap) => clap.user)
  claps: Clap[];

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt: Date;

  @Field()
  @Column({ unique: true })
  username!: string;

  @Column({ type: "text" })
  password!: string;

  @Field()
  @Column({ unique: true })
  email!: string;
}
