import { MyContext } from './../types';
import { MiddlewareFn } from "type-graphql";

export const isAuth: MiddlewareFn<MyContext> = ({ context }, next) => {
	// for some reason, this doesn't work when I destructure req off of context 🤷
	if (!context.req.session.userId) {
		throw new Error('unauthorized');
	}

	return next();
}