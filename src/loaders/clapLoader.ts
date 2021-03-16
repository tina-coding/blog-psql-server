import { Clap } from "./../entities/Clap";
import DataLoader from "dataloader";
export const createClapLoader = () =>
  new DataLoader<{ postId: number; userId: number }, Clap | null>(async (keys) => {
    const claps = await Clap.findByIds(keys as any);

    const clapsToObj: Record<string, Clap> = claps.reduce(
      (prevClap, currentClap) =>
        Object.assign(prevClap, { [`${currentClap.userId}|${currentClap.postId}`]: currentClap }),
      {}
    ); // create object with all the claps with their id's as keys, { 1: {username: 'ursla', email: ...}, 2: {username: 'jane' ...}}

    return keys.map((key) => clapsToObj[`${key.userId}|${key.postId}`]);
  });
