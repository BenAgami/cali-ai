import { Request, Response, NextFunction, RequestHandler } from "express";

type AsyncHandler<
  P = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = qs.ParsedQs,
> = (
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

const asyncHandler = <
  P = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = qs.ParsedQs,
>(
  fn: AsyncHandler<P, ResBody, ReqBody, ReqQuery>,
): RequestHandler<P, ResBody, ReqBody, ReqQuery> =>
  (req, res, next): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export default asyncHandler;
