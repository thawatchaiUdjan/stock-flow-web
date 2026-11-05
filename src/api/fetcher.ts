import type { ErrorModel } from "./generated/model";

export class ApiError extends Error {
  status: number;
  problem: ErrorModel;

  constructor(status: number, problem: ErrorModel) {
    super(problem.title);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
  }
}

// Orval types each hook's error through this export: what is thrown is an ApiError.
export type ErrorType<_Body> = ApiError;

function parseProblem(body: string, response: Response): ErrorModel {
  try {
    return JSON.parse(body) as ErrorModel;
  } catch {
    return { status: response.status, title: response.statusText };
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.text();

  if (!response.ok) {
    throw new ApiError(response.status, parseProblem(body, response));
  }
  return (body ? JSON.parse(body) : undefined) as T;
}
