import { COOKIE_NAME, FORGOT_PASSWORD_PREFIX } from "./../constants";
import argon2 from "argon2";
import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Query, Resolver } from "type-graphql";

import { User } from "./../entities/User";

import { MyContext } from "./../types";
import { sendEmail } from "../utils/sendEmail";
import { v4 } from "uuid";

@InputType()
class RegisterInput {
  @Field()
  username: string;
  @Field()
  email: string;
  @Field()
  password: string;
}
@InputType()
class LoginInput {
  @Field()
  username: string;
  @Field()
  password: string;
}

@InputType()
class ChangePasswordInput {
  @Field()
  token: string;
  @Field()
  newPassword: string;
}

@ObjectType()
class FieldError {
  @Field(() => String)
  field: keyof RegisterInput | keyof LoginInput | keyof ChangePasswordInput;
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
  @Mutation(() => UserResponse)
  async changePassword(
    @Arg("options") options: ChangePasswordInput,
    @Ctx() { em, redis, req }: MyContext
  ): Promise<UserResponse> {
    const { newPassword, token } = options;

    if (newPassword.length < 8) {
      return {
        errors: [
          {
            field: "newPassword",
            message: "password must have at least 8 characters"
          }
        ]
      };
    }

    const userId = await redis.get(FORGOT_PASSWORD_PREFIX + token);

    if (!userId) {
      return {
        errors: [
          {
            field: "token",
            message: "token has expired"
          }
        ]
      };
    }

    const user = await em.findOne(User, { id: parseInt(userId) });

    if (!user) {
      return {
        errors: [
          {
            field: "token",
            message: "user does not exist"
          }
        ]
      };
    }

    user.password = await argon2.hash(newPassword);

    await em.persistAndFlush(user);

    req.session.userId = user.id; // login user after password reset
    return { user };
  }

  @Mutation(() => Boolean)
  async forgotPassword(@Arg("email") email: string, @Ctx() { em, redis }: MyContext) {
    const user = await em.findOne(User, { email });

    if (!user) {
      return true; //email not in db
    }

    // send user a link to reset password
    const token = v4(); // create unique token
    await redis.set(FORGOT_PASSWORD_PREFIX + token, user.id, "ex", 1000 * 60 * 60 * 24); // 1 day to reset password
    const resetLink = `<a href="http:localhost:3000/change-password/${token}">reset password</a>`;
    await sendEmail(email, resetLink);

    return true;
  }

  @Query(() => [User], { nullable: true })
  async getUsers(@Ctx() { em }: MyContext) {
    return await em.find(User, {});
  }

  @Query(() => User, { nullable: true })
  async currentUser(@Ctx() { em, req }: MyContext) {
    // user not logged in
    if (!req.session.userId) {
      return null;
    }

    return await em.findOne(User, { id: req.session.userId });
  }

  @Mutation(() => UserResponse)
  async register(@Arg("options") options: RegisterInput, @Ctx() { em, req }: MyContext): Promise<UserResponse> {
    if (!options.email.includes("@")) {
      return {
        errors: [
          {
            field: "email",
            message: "must add valid email"
          }
        ]
      };
    }

    if (options.username.length < 3) {
      return {
        errors: [
          {
            field: "username",
            message: "username must have at least 3 characters"
          }
        ]
      };
    }

    if (options.password.length < 8) {
      return {
        errors: [
          {
            field: "password",
            message: "password must have at least 8 characters"
          }
        ]
      };
    }

    const hashedPassword = await argon2.hash(options.password);
    const user = em.create(User, {
      username: options.username,
      email: options.email,
      password: hashedPassword
    });
    try {
      await em.persistAndFlush(user);
    } catch (error) {
      // duplicate username
      if (error.detail.includes("already exists") || error.code === "23505") {
        return {
          errors: [
            {
              field: "username",
              message: "username has already been taken"
            }
          ]
        };
      }
    }

    // login user by setting the user id on the session
    // creates a cookie for the user and keeps them logged in
    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => UserResponse)
  async login(@Arg("options") options: LoginInput, @Ctx() { em, req }: MyContext): Promise<UserResponse> {
    const user = await em.findOne(User, { username: options.username }); // fetch user

    if (!user) {
      return {
        errors: [
          {
            field: "username",
            message: "username does not exist"
          }
        ]
      };
    }

    const validPassword = await argon2.verify(user.password, options.password); // verify password is correct

    if (!validPassword) {
      return {
        errors: [
          {
            field: "password",
            message: "password incorrect"
          }
        ]
      };
    }

    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        if (err) {
          console.error(err);
          resolve(false);
          return;
        }

        res.clearCookie(COOKIE_NAME); // remove cookie if successfully destroyed session
        resolve(true);
      })
    );
  }
}
