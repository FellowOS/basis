export type ApiErrorDetail = {
  code?: string;
  message?: string;
};

export function errorFromApiResponse(
  status: number,
  data: unknown,
  fallbackMessage?: string,
): Error {
  const raw = (data as { detail?: ApiErrorDetail | string })?.detail;
  const detail: ApiErrorDetail =
    typeof raw === 'string' ? { message: raw } : (raw ?? {});
  const defaultMessage =
    fallbackMessage
    || (status === 401 || status === 403
      ? 'Unauthorized'
      : `Request failed (${status})`);
  // When the API sends a stable code, UI should map via the registry — not show raw server text.
  const err = new Error(
    detail.code
      ? ''
      : (detail.message?.trim() || defaultMessage),
  );
  if (detail.code) {
    (err as Error & { code?: string }).code = detail.code;
  }
  return err;
}

export async function throwIfApiNotOk(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }
  const data = await response.json().catch(() => ({}));
  throw errorFromApiResponse(response.status, data);
}
