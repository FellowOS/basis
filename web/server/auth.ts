import { basisApiTarget } from './config.ts';

export async function assertBasisSession(headers: Headers): Promise<boolean> {
  const forward = new Headers();
  const auth = headers.get('authorization');
  if (auth?.trim()) {
    forward.set('authorization', auth);
  }
  const cookie = headers.get('cookie');
  if (cookie?.trim()) {
    forward.set('cookie', cookie);
  }
  if (!forward.has('authorization') && !forward.has('cookie')) {
    return false;
  }
  const response = await fetch(`${basisApiTarget()}/api/v1/auth/me`, { headers: forward });
  return response.ok;
}
