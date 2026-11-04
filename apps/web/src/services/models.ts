import { API_BASE } from '../constants/api';
import { HttpError, requestJson } from './http';
import type { ProviderConfig, ProviderModelOption } from './providers';

/** True when the backend can list models for this provider rather than the server default. */
export function canFetchProviderModels(provider: ProviderConfig): boolean {
  // Builtin providers fall back to the server's key for that provider; custom ones need an endpoint.
  return Boolean(provider.builtin || provider.baseUrl);
}

/** The backend `detail` text for a failed model request, else the error message. */
export function describeModelError(error: unknown): string {
  if (error instanceof HttpError) {
    try {
      const { detail } = JSON.parse(error.body) as { detail?: unknown };
      if (typeof detail === 'string' && detail) return detail;
    } catch {
      // Non-JSON body: fall through to the raw message.
    }
  }
  return error instanceof Error ? error.message : 'Failed to load models';
}

/** Fetch the live model list for a provider through the backend gateway. */
export async function fetchProviderModels(
  serverKey: string,
  provider: ProviderConfig
): Promise<ProviderModelOption[]> {
  const providerFields = {
    x_provider: provider.id,
    ...(provider.apiKey ? { x_provider_api_key: provider.apiKey } : {}),
    ...(provider.baseUrl ? { x_provider_base_url: provider.baseUrl } : {}),
  };

  const data = await requestJson<{ data?: ProviderModelOption[] }>(`${API_BASE}/models`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serverKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(providerFields),
  });
  return (data.data ?? []).map(({ id, name }) => ({ id, name }));
}
