export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// The public response never includes the provider response, prompt, token or stack.
export function errorResponse(error) {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: { success: false, code: error.code, error: error.message },
    };
  }
  return {
    status: 500,
    body: { success: false, code: 'INTERNAL_ERROR', error: 'Erro interno. Tente novamente.' },
  };
}
