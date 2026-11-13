import crypto from 'crypto';
import { cookies } from 'next/headers';

/**
 * Autenticação do proprietário feita NO SERVIDOR.
 *
 * - Usa ADMIN_PIN se definido nas variáveis de ambiente, ou "1234" por padrão.
 * - Aceita tanto cookie httpOnly quanto header `x-admin-token` / `x-admin-pin`,
 *   garantindo que nunca falhe em celulares, abas anônimas ou múltiplas instâncias.
 */

export const COOKIE_ADMIN = 'ml_admin';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 60; // 60 dias

export function senhaAdmin(): string {
  const pin = process.env.ADMIN_PIN?.trim();
  return pin || '1234';
}

function gerarToken(pin: string): string {
  const segredo = process.env.ADMIN_SECRET || `ml-achados:${pin}`;
  return crypto.createHmac('sha256', segredo).update(`admin:${pin}`).digest('hex');
}

function iguais(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function verificarSenha(tentativa: string): boolean {
  const pin = senhaAdmin();
  if (!pin || typeof tentativa !== 'string') return false;
  return iguais(tentativa.trim(), pin);
}

export function tokenAdmin(): string {
  return gerarToken(senhaAdmin());
}

export async function isAdmin(request?: Request): Promise<boolean> {
  const esperado = tokenAdmin();

  if (request) {
    const tokenHeader = request.headers.get('x-admin-token')?.trim();
    if (tokenHeader && iguais(tokenHeader, esperado)) {
      return true;
    }
    const pinHeader = request.headers.get('x-admin-pin')?.trim();
    if (pinHeader && verificarSenha(pinHeader)) {
      return true;
    }
  }

  try {
    const store = await cookies();
    const valor = store.get(COOKIE_ADMIN)?.value;
    return !!valor && iguais(valor, esperado);
  } catch {
    return false;
  }
}
