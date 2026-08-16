import { prisma } from "../config/prisma";

export class GitHubError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number = 400) {
        super(message);
        this.name = "GitHubError";
        this.statusCode = statusCode;
    }
}

export interface ParsedGitHubUrl {
    owner: string;
    repo: string;
}

export interface GitHubRepositoryInfo {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    html_url: string;
    default_branch: string;
    owner: {
        login: string;
    };
}

/**
 * Parses a GitHub repository URL to extract the owner and repository name.
 * Supports:
 * - https://github.com/owner/repository
 * - https://github.com/owner/repository.git
 * - http://github.com/owner/repository
 * - git@github.com:owner/repository.git
 */
export function parseGitHubUrl(url: string): ParsedGitHubUrl {
    if (!url || typeof url !== "string") {
        throw new GitHubError("Repository URL is required and must be a string.", 400);
    }

    const trimmed = url.trim();
    const githubRegex = /^(?:https?:\/\/(?:www\.)?github\.com\/|git@github\.com:)([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?\/?$/;
    const match = trimmed.match(githubRegex);

    if (!match || !match[1] || !match[2]) {
        throw new GitHubError("Invalid GitHub repository URL format.", 400);
    }

    let repo = match[2];
    if (repo.endsWith(".git")) {
        repo = repo.slice(0, -4);
    }

    const owner = match[1];

    if (!owner || !repo) {
        throw new GitHubError("Invalid GitHub repository URL format.", 400);
    }

    return { owner, repo };
}

/**
 * Fetches repository information from the GitHub REST API.
 */
export async function fetchGitHubRepository(owner: string, repo: string): Promise<GitHubRepositoryInfo> {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "DevDeploy-Backend",
    };

    const token = process.env.GITHUB_TOKEN?.trim();
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    let response: Response;
    try {
        response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
            method: "GET",
            headers,
        });
    } catch (networkError) {
        console.error("GitHub API network error:", networkError);
        throw new GitHubError("GitHub API is unavailable.", 502);
    }

    if (response.status === 404) {
        throw new GitHubError("GitHub repository not found or is private.", 404);
    }

    if (response.status === 401 || response.status === 403) {
        const errorData = (await response.json().catch(() => ({}))) as { message?: string };
        const message = errorData.message || "GitHub API rate limit exceeded or unauthorized.";
        console.error("GitHub API authentication/rate limit error:", response.status, message);
        throw new GitHubError(`GitHub API error: ${message}`, 502);
    }

    if (!response.ok) {
        throw new GitHubError("GitHub API is unavailable.", 502);
    }

    const data = (await response.json()) as any;

    return {
        id: data.id,
        name: data.name,
        full_name: data.full_name,
        private: Boolean(data.private),
        html_url: data.html_url,
        default_branch: data.default_branch,
        owner: {
            login: data.owner?.login,
        },
    };
}

/**
 * Fetches the latest commit SHA for a specific branch from the GitHub REST API.
 */
export async function fetchLatestCommitSha(owner: string, repo: string, branch: string): Promise<string> {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "DevDeploy-Backend",
    };

    const token = process.env.GITHUB_TOKEN?.trim();
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    let response: Response;
    try {
        response = await fetch(
            `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(branch)}`,
            {
                method: "GET",
                headers,
            }
        );
    } catch (networkError) {
        console.error("GitHub API network error while fetching latest commit:", networkError);
        throw new GitHubError("GitHub API is unavailable.", 502);
    }

    if (response.status === 404) {
        throw new GitHubError(`Branch '${branch}' or repository not found.`, 404);
    }

    if (response.status === 401 || response.status === 403) {
        const errorData = (await response.json().catch(() => ({}))) as { message?: string };
        const message = errorData.message || "GitHub API rate limit exceeded or unauthorized.";
        console.error("GitHub API auth/rate limit error:", response.status, message);
        throw new GitHubError(`GitHub API error: ${message}`, 502);
    }

    if (!response.ok) {
        throw new GitHubError("GitHub API is unavailable.", 502);
    }

    const data = (await response.json()) as any;

    if (!data || !data.sha || typeof data.sha !== "string") {
        throw new GitHubError("Unable to retrieve commit SHA from GitHub API response.", 502);
    }

    return data.sha;
}

export class GitHubService {
    /**
     * Parses a repository URL into owner and repo name.
     */
    parseRepositoryUrl(url: string): ParsedGitHubUrl {
        return parseGitHubUrl(url);
    }

    /**
     * Directly fetches repository information by owner and repo name.
     */
    async getRepositoryInfo(owner: string, repo: string): Promise<GitHubRepositoryInfo> {
        return fetchGitHubRepository(owner, repo);
    }

    /**
     * Retrieves the latest commit SHA for a branch in a repository.
     */
    async getLatestCommitSha(owner: string, repo: string, branch: string): Promise<string> {
        return fetchLatestCommitSha(owner, repo, branch);
    }

    /**
     * Retrieves GitHub repository information for a specific project owned by the user.
     */
    async getProjectRepositoryInfo(projectId: number, userId: number): Promise<GitHubRepositoryInfo> {
        const project = await prisma.project.findFirst({
            where: { id: projectId, userId },
        });

        if (!project) {
            throw new GitHubError("Project not found", 404);
        }

        if (!project.repositoryUrl || typeof project.repositoryUrl !== "string" || project.repositoryUrl.trim().length === 0) {
            throw new GitHubError("Project repository URL is missing or invalid.", 400);
        }

        const { owner, repo } = parseGitHubUrl(project.repositoryUrl);
        return fetchGitHubRepository(owner, repo);
    }
}

export const githubService = new GitHubService();
