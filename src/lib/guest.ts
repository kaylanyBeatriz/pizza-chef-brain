// Acesso sem conta: o botão da tela inicial liga esta flag e as rotas internas deixam de exigir login.
const KEY = "bp-guest-access";

export function isGuestAccess(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function enableGuestAccess() {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Sem storage (aba privada/bloqueado): o acesso vale só até recarregar.
  }
  guestInMemory = true;
}

export function disableGuestAccess() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignora
  }
  guestInMemory = false;
}

let guestInMemory = false;

export function hasGuestAccess(): boolean {
  return guestInMemory || isGuestAccess();
}
