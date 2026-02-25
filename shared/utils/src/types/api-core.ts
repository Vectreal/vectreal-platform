import type { SubmitTarget } from 'react-router';

// Standard CSRF token for all requests
export interface CsrfToken {
  csrf: string;
}

// Base request interface
export type BaseRequest = CsrfToken & SubmitTarget;

// HTTP status codes as a type
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500,
}

// Standard error types
export interface ApiError {
  error?: string;
  status: HttpStatus;
}

// Standard API response structure
export interface ApiResponseType<T = unknown> extends ApiError {
  success: boolean;
  message?: string;
  data?: T;
}
