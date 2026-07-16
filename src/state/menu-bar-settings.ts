export const MENU_BAR_ENABLED_KEY = "menu-bar-enabled";

export function shouldShowMenuBar(storedEnabled: boolean | undefined, isUserInitiated: boolean): boolean {
  return isUserInitiated || storedEnabled !== false;
}
