"use client";

/**
 * Confirmations and notifications, drawn with SweetAlert2.
 *
 * SweetAlert2 is loaded on first use (it touches `document`), so pages still
 * prerender as static shells. App dialogs (<dialog>.showModal()) sit in the
 * browser's top layer, above anything else; alerts are mounted inside the open
 * dialog when there is one, so they are never hidden behind it.
 */
import type { SweetAlertIcon } from "sweetalert2";

type Swal = typeof import("sweetalert2").default;
let loading: Promise<Swal> | null = null;

const load = () =>
  (loading ??= import("sweetalert2").then(({ default: Swal }) =>
    // heightAuto: false stops SweetAlert2 resizing <html>/<body>, which would shift the sticky layout.
    Swal.mixin({ heightAuto: false, buttonsStyling: true, customClass: { popup: "prangon-swal" } }),
  ));

const COLORS = { accent: "#4f46e5", danger: "#dc2626", cancel: "#64748b" };

/** The top-most open app dialog, or the page. */
const target = (): HTMLElement => {
  const open = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
  return open[open.length - 1] ?? document.body;
};

/**
 * Asks before something destructive or hard to undo. Resolves true only when
 * the person confirms; Escape, the backdrop and Cancel all resolve false.
 */
export async function confirmAction({
  title,
  text,
  confirmText = "Yes, continue",
  cancelText = "Cancel",
  danger = false,
  icon,
}: {
  title: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
  /** Red confirm button, warning icon, and Cancel focused by default. */
  danger?: boolean;
  icon?: SweetAlertIcon;
}): Promise<boolean> {
  const Swal = await load();
  const result = await Swal.fire({
    title,
    text,
    icon: icon ?? (danger ? "warning" : "question"),
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: danger ? COLORS.danger : COLORS.accent,
    cancelButtonColor: COLORS.cancel,
    reverseButtons: true,
    focusCancel: danger,
    target: target(),
  });
  return result.isConfirmed;
}

/** A short notification in the top-right corner that dismisses itself. */
export async function notify(message: string, tone: "success" | "error" = "success") {
  const Swal = await load();
  // Let a dialog that closes with this action finish closing before choosing where to show.
  await new Promise((resolve) => setTimeout(resolve, 80));
  void Swal.fire({
    toast: true,
    position: "top-end",
    icon: tone,
    title: message,
    showConfirmButton: false,
    timer: tone === "error" ? 5000 : 3500,
    timerProgressBar: true,
    target: target(),
    didOpen: (popup) => {
      popup.addEventListener("mouseenter", () => Swal.stopTimer());
      popup.addEventListener("mouseleave", () => Swal.resumeTimer());
    },
  });
}
