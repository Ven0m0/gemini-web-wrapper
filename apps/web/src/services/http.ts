export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** Fetch JSON; non-2xx responses throw an HttpError carrying status and body text. */
export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new HttpError(response.status, `${response.status} ${response.statusText}${body ? `: ${body}` : ''}`);
  }
  return response.json() as Promise<T>;
}
