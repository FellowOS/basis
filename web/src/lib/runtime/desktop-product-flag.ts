/** Set when ``/api/v1/auth/desktop-session`` succeeds (desktop API profile). */

let apiDesktopProduct = false;

export function markApiDesktopProduct(): void {
  apiDesktopProduct = true;
}

export function isApiDesktopProduct(): boolean {
  return apiDesktopProduct;
}
