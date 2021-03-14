import argon2 from "argon2";
import { Arg, Ctx, Field, FieldResolver, InputType, Mutation, ObjectType, Query, Resolver, Root } from "type-graphql";
import { v4 } from "uuid";
import { sendEmail } from "../utils/sendEmail";
import { COOKIE_NAME, FORGOT_PASSWORD_PREFIX } from "./../constants";
import { User } from "./../entities/User";
import { MyContext } from "./../types";

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

@Resolver(User)
export class UserResolver {
  @FieldResolver(() => String)
  userEmail(@Root() user: User, @Ctx() { req }: MyContext): string {
    if (req.session.userId === user.id) {
      //return email only if current user is
      return user.email;
    }
    return ""; // if current user is not the same as the user they should not see email data
  }
  @Mutation(() => UserResponse)
  async changePassword(
    @Arg("options") options: ChangePasswordInput,
    @Ctx() { redis, req }: MyContext
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

    const redisKey = FORGOT_PASSWORD_PREFIX + token;
    const userId = await redis.get(redisKey);

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

    const userIdInt = parseInt(userId);
    const user = await User.findOne(userIdInt);

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

    User.update({ id: userIdInt }, { password: await argon2.hash(newPassword) });

    await redis.del(redisKey); // remove the token to prevent reuse
    req.session.userId = user.id; // login user after password reset
    return { user };
  }

  @Mutation(() => Boolean)
  async forgotPassword(@Arg("email") email: string, @Ctx() { redis }: MyContext): Promise<boolean> {
    const user = await User.findOne({ where: { email } });

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
  async getUsers(): Promise<User[]> {
    return User.find();
  }

  @Query(() => User, { nullable: true })
  async currentUser(@Ctx() { req }: MyContext): Promise<User | undefined | null> {
    // user not logged in
    if (!req.session.userId) {
      return null;
    }

    return User.findOne(req.session.userId);
  }

  @Mutation(() => UserResponse)
  async register(@Arg("options") options: RegisterInput, @Ctx() { req }: MyContext): Promise<UserResponse> {
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
    let user;
    try {
      user = await User.create({
        username: options.username,
        email: options.email,
        password: hashedPassword
      }).save();
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
    req.session.userId = user && user.id; // janky way to make typescript happy 🤧

    return { user };
  }

  @Mutation(() => UserResponse)
  async login(@Arg("options") options: LoginInput, @Ctx() { req }: MyContext): Promise<UserResponse> {
    const user = await User.findOne({ where: { username: options.username } }); // fetch user
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
  logout(@Ctx() { req, res }: MyContext): Promise<boolean> {
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
