// Asks "are you sure?" inside the page with a toast, instead of the browser's confirm dialog

import { toast } from "sonner";

/** A warning toast with Confirm and Cancel buttons that stays open until one is chosen. */
export function confirmToast({ id, title, description, confirmLabel = "Delete", onConfirm }: {
  /** One prompt per item: a second click replaces it instead of stacking another. */
  id: string;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  toast.warning(title, {
    id,
    description,
    duration: Infinity,
    action: { label: confirmLabel, onClick: onConfirm },
    cancel: { label: "Cancel", onClick: () => undefined },
  });
}
