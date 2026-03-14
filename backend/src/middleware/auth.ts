import { clerkMiddleware, getAuth } from "@clerk/express";
import { Request, Response, NextFunction } from "express";

export const clerkAuth = clerkMiddleware();

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({
      error: "No autorizado. Debes iniciar sesión.",
    });
    return;
  }

  next();
};