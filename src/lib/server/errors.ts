// Errors the service layer throws. Routes map them to HTTP status codes; messages are Polish for the UI.
export type ErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'INVALID'
  | 'TERM_TAKEN'
  | 'TERM_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'BAD_CODE'
  | 'CONFLICT';

const STATUS: Record<ErrorCode, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
  INVALID: 400,
  TERM_TAKEN: 409,
  TERM_UNAVAILABLE: 409,
  RATE_LIMITED: 429,
  BAD_CODE: 400,
  CONFLICT: 409
};

export class AppError extends Error {
  code: ErrorCode;
  /** Extra fields for the JSON answer (for example a phoneToken with TERM_TAKEN). */
  data?: Record<string, unknown>;
  constructor(code: ErrorCode, message: string, data?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.data = data;
  }
  get status(): number {
    return STATUS[this.code];
  }
}

export const notFound = (what = 'Nie znaleziono.') => new AppError('NOT_FOUND', what);
export const forbidden = () => new AppError('FORBIDDEN', 'Nie masz do tego uprawnień.');
export const unauthorized = () => new AppError('UNAUTHORIZED', 'Zaloguj się, aby kontynuować.');
export const invalid = (msg: string) => new AppError('INVALID', msg);
