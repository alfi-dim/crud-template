import { data, redirect } from "react-router";
import type { RouterContextProvider } from "react-router";
import { getRequestSession, markSessionDirty, type ToastFlash } from "~/sessions.server";

/**
 * Redirects the user to a specified URL with a toast message added to the session.
 *
 * @param {RouterContextProvider} context - The current request context.
 * @param {string} to - The target URL to redirect the user to.
 * @param {Omit<ToastFlash, "id"> & { id?: string }} toast - The toast message to be flashed, optionally allowing an ID to be specified.
 */
export function redirectWithToast(
  context: Readonly<RouterContextProvider>,
  to: string,
  toast: Omit<ToastFlash, "id"> & { id?: string },
) {
  const { session } = getRequestSession(context);

  session.flash("toast", { ...toast, id: toast.id || crypto.randomUUID() });
  markSessionDirty(context);

  return redirect(to);
}

/**
 * Executes a request by storing a toast message in the session and returning the provided data along with session headers.
 *
 * @param {RouterContextProvider} context - The current request context.
 * @param {T} value - The value to be sent as a response.
 * @param {Omit<ToastFlash, "id"> & { id?: string }} toast - The toast message object with an optional `id` field.
 */
export function dataWithToast<T>(
  context: Readonly<RouterContextProvider>,
  value: T,
  toast: Omit<ToastFlash, "id"> & { id?: string },
) {
  const { session } = getRequestSession(context);

  session.flash("toast", { ...toast, id: toast?.id || crypto.randomUUID() });
  markSessionDirty(context);

  return data(value);
}
