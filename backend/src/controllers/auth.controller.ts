import { Request, Response } from "express";
import { authService, AuthError } from "../services/auth.service";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthController {
    /**
     * POST /api/auth/register
     * Handles user registration
     */
    async register(req: Request, res: Response): Promise<void> {
        try {
            const { name, email, password } = req.body;

            // Validate presence of required fields
            if (!name || typeof name !== "string" || name.trim().length === 0) {
                res.status(400).json({
                    message: "Name is required and must be a non-empty string.",
                });
                return;
            }

            if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
                res.status(400).json({
                    message: "A valid email address is required.",
                });
                return;
            }

            if (!password || typeof password !== "string" || password.length < 6) {
                res.status(400).json({
                    message: "Password is required and must be at least 6 characters long.",
                });
                return;
            }

            const user = await authService.register({
                name,
                email,
                password,
            });

            res.status(201).json({
                message: "User registered successfully",
                user,
            });
        } catch (error: any) {
            if (error instanceof AuthError) {
                res.status(error.statusCode).json({
                    message: error.message,
                });
                return;
            }

            // Handle Prisma unique constraint race conditions if triggered
            if (error?.code === "P2002") {
                res.status(409).json({
                    message: "Email is already registered",
                });
                return;
            }

            console.error("Registration error:", error);
            res.status(500).json({
                message: "Internal server error occurred during registration",
            });
        }
    }

    /**
     * POST /api/auth/login
     * Handles user login and JWT token issuance
     */
    async login(req: Request, res: Response): Promise<void> {
        try {
            const { email, password } = req.body;

            if (!email || typeof email !== "string" || !password || typeof password !== "string") {
                res.status(400).json({
                    message: "Email and password are required.",
                });
                return;
            }

            const result = await authService.login({
                email,
                password,
            });

            res.status(200).json({
                message: "Login successful",
                token: result.token,
                user: result.user,
            });
        } catch (error: any) {
            if (error instanceof AuthError) {
                res.status(error.statusCode).json({
                    message: error.message,
                });
                return;
            }

            console.error("Login error:", error);
            res.status(500).json({
                message: "Internal server error occurred during login",
            });
        }
    }

    /**
     * GET /api/auth/me
     * Retrieves the profile of the authenticated user
     */
    async getMe(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                res.status(401).json({
                    message: "User not authenticated",
                });
                return;
            }

            const user = await authService.getProfile(userId);

            res.status(200).json({
                user,
            });
        } catch (error: any) {
            if (error instanceof AuthError) {
                res.status(error.statusCode).json({
                    message: error.message,
                });
                return;
            }

            console.error("Get profile error:", error);
            res.status(500).json({
                message: "Internal server error occurred while retrieving profile",
            });
        }
    }
}

export const authController = new AuthController();
