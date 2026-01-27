import { login, register, loginAsGuest } from "../api";

export function initLoginScreen(onLoggedIn: () => void) {
  const emailEl = document.getElementById("login-email") as HTMLInputElement;
  const passEl = document.getElementById("login-password") as HTMLInputElement;
  const errorEl = document.getElementById("login-error")!;

  document.getElementById("btn-login")!.addEventListener("click", async () => {
    errorEl.textContent = "";
    try {
      await login(emailEl.value, passEl.value);
      onLoggedIn();
    } catch (e: any) {
      errorEl.textContent = e.message;
    }
  });

  document.getElementById("btn-register")!.addEventListener("click", async () => {
    errorEl.textContent = "";
    try {
      await register(emailEl.value, passEl.value);
      onLoggedIn();
    } catch (e: any) {
      errorEl.textContent = e.message;
    }
  });

  document.getElementById("btn-guest")!.addEventListener("click", () => {
    loginAsGuest();
    onLoggedIn();
  });
}
