import { User } from "./../entities/User";
import DataLoader from "dataloader";

export const createUserLoader = (): DataLoader<number, User, number> =>
  new DataLoader<number, User>(async (keys) => {
    const users = await User.findByIds(keys as number[]); // find all users by the ids,[{id: 1, username: 'ursla', email: ...}]

    const usersToObj: Record<number, User> = users.reduce(
      (prevUser, currentUser) => Object.assign(prevUser, { [currentUser.id]: currentUser }),
      {}
    ); // create object with all the users with their id's as keys, { 1: {username: 'ursla', email: ...}, 2: {username: 'jane' ...}}

    return keys.map((key) => usersToObj[key]);
  });
