// fetch() wrapper for the JSON API. Errors come back with the server's Polish message.
export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
  error: string;
}

export async function api<T = Record<string, unknown>>(
  method: string,
  url: string,
  body?: unknown
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    return {
      ok: res.ok,
      status: res.status,
      data: json as T,
      error: res.ok ? '' : (json?.error?.message ?? 'Coś poszło nie tak. Spróbuj ponownie.')
    };
  } catch {
    return { ok: false, status: 0, data: {} as T, error: 'Brak połączenia. Spróbuj ponownie.' };
  }
}
