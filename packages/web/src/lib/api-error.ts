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
  const err = new Error(
    detail.message?.trim()
      || fallbackMessage
      || (status === 401 || status === 403
        ? 'Unauthorized'
        : `Request failed (${status})`),
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
