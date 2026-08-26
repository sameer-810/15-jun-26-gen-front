import { http } from "@/shared/api/http";

/**
 * Fetch a PDF endpoint (which needs the Authorization header) and show it.
 *
 * The window is claimed **before** the request, not after it. Safari on iOS only
 * allows a new window from inside the synchronous part of a user gesture, and
 * fetching the PDF is a round-trip — by the time the blob arrives the gesture is
 * over and the popup is silently blocked, so nothing opens. Desktop browsers and
 * Android are permissive enough that opening afterwards appears to work, which
 * is how this reaches production looking fine.
 *
 * `noopener` is deliberately absent: it makes `window.open` return null, and the
 * handle is needed to point the tab at the blob once it has downloaded.
 */
export async function openAuthenticatedPdf(path: string) {
  const win = window.open("", "_blank");

  try {
    const res = await http.get(path, { responseType: "blob" });
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    if (win && !win.closed) {
      win.location.href = url;
    } else {
      // Blocked anyway, or opened from somewhere with no gesture. Showing it in
      // this tab still beats appearing to do nothing.
      window.location.href = url;
    }

    // Revoke once the tab has had time to load it.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return url;
  } catch (err) {
    win?.close();
    throw err;
  }
}

/**
 * Download a PDF endpoint as a named file.
 *
 * Note for iOS: Safari ignores the `download` attribute on a blob URL, so this
 * opens the PDF in the viewer instead of saving it. That is the platform's
 * behaviour, not a fault here — the user saves it from the viewer's share sheet.
 */
export async function downloadAuthenticatedPdf(path: string, filename: string) {
  const res = await http.get(path, { responseType: "blob" });
  const blob = new Blob([res.data], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
