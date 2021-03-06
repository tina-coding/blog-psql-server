import argon2 from 'argon2';
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  ObjectType,
	Query,
  Resolver
} from 'type-graphql';

import { User } from './../entities/User';

import { MyContext } from './../types';

@InputType()
class UsernamePasswordInput {
  @Field()
  username: string;
  @Field()
	password: string;
}

@ObjectType()
class FieldError {
  @Field(() => String)
  field: keyof UsernamePasswordInput;
  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver()
export class UserResolver {

	@Query(() => User, { nullable: true })
	async currentUser(@Ctx() { em, req }: MyContext) {
		// user not logged in
		if (!req.session.userId) {
			return null;
		}

		const user = await em.findOne(User, { id: req.session.userId });
		return user;
	}

  @Mutation(() => UserResponse)
  async register(
    @Arg('options') options: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
	): Promise<UserResponse> {

		if (options.username.length < 3) {
			return {
				errors: [{
					field: 'username',
					message: "username must have at least 3 characters"
				}]
			}
		}

		if (options.password.length < 8) {
			return {
				errors: [{
					field: 'password',
					message: 'password must have at least 8 characters'
				}]
			}
		}

    const hashedPassword = await argon2.hash(options.password);
    const user = em.create(User, {
      username: options.username,
      password: hashedPassword
		});
		try {
			await em.persistAndFlush(user);
		} catch (error) {
			// duplicate username
			if (error.detail.includes("already exists") || error.code === "23505") {
				return {
					errors: [{
						field: 'username',
						message: 'username has already been taken'
					}]
				}
			}
		}

		// login user by setting the user id on the session
		// creates a cookie for the user and keeps them logged in
		req.session.userId = user.id;

    return {user};
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg('options') options: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(User, { username: options.username }); // fetch user

    if (!user) {
			return {
				errors: [{
					field: 'username',
					message: 'username does not exist'
				}]
      };
		}

		const validPassword = await argon2.verify(user.password, options.password); // verify password is correct

		if (!validPassword) {
			return {
				errors: [{
					field: 'password',
					message: 'password incorrect'
				}]
			}
		}

		req.session.userId = user.id;

    return {user};
  }
}
