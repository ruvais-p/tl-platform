export type LogoutNavigation = { redirect_to: string; auth0: boolean };

export function navigateAfterLogout(
  result: LogoutNavigation,
  replace: (path: string) => void,
  assign: (path: string) => void = (path) => window.location.assign(path),
) {
  if (result.auth0) assign(result.redirect_to);
  else replace(result.redirect_to);
}
