import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";

export class AuthError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number = 400) {
        super(message);
        this.name = "AuthError";
        this.statusCode = statusCode;
    }
}

export interface RegisterInput {
    name: string;
    email: string;
    password: string;
}

export interface LoginInput {
    email: string;
    password: string;
}

export interface SanitizedUser {
    id: number;
    name: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface LoginResult {
    token: string;
    user: SanitizedUser;
}

export class AuthService {
    /**
     * Registers a new user with hashed password and checks for duplicate email.
     */
    async register(input: RegisterInput): Promise<SanitizedUser> {
        const { name, email, password } = input;
        const normalizedEmail = email.trim().toLowerCase();
        const trimmedName = name.trim();

        const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        if (existingUser) {
            throw new AuthError("Email is already registered", 409);
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const user = await prisma.user.create({
            data: {
                name: trimmedName,
                email: normalizedEmail,
                password: hashedPassword,
            },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return user;
    }

    /**
     * Authenticates a user with email and password, returning a signed JWT and sanitized user info.
     */
    async login(input: LoginInput): Promise<LoginResult> {
        const { email, password } = input;
        const normalizedEmail = email.trim().toLowerCase();

        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        if (!user) {
            throw new AuthError("Invalid email or password", 401);
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new AuthError("Invalid email or password", 401);
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error("JWT_SECRET environment variable is not defined");
        }

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
            },
            jwtSecret,
            { expiresIn: "7d" }
        );

        const safeUser: SanitizedUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };

        return {
            token,
            user: safeUser,
        };
    }

    /**
     * Retrieves user profile details by userId, omitting sensitive information.
     */
    async getProfile(userId: number): Promise<SanitizedUser> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            throw new AuthError("User not found", 404);
        }

        return user;
    }
}

export const authService = new AuthService();
