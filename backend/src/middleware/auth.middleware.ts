import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface JwtUserPayload {
    userId: number;
    email: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: JwtUserPayload;
        }
    }
}

/**
 * Middleware that authenticates incoming requests using a Bearer JWT.
 * Attaches decoded userId and email to req.user.
 */
export const authenticateToken = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    let token: string | undefined;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
    } else if (req.query && typeof req.query.token === "string") {
        token = req.query.token;
    }

    if (!token) {
        res.status(401).json({
            message: "Authorization token missing or malformed",
        });
        return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error("JWT_SECRET environment variable is not defined");
        res.status(500).json({
            message: "Internal server configuration error",
        });
        return;
    }

    try {
        const decoded = jwt.verify(token, secret) as JwtUserPayload;
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({
            message: "Invalid or expired authorization token",
        });
        return;
    }
};
