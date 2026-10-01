import { Toaster as Sonner, type ToasterProps } from "sonner";

// shadcn/ui toast container, styled for the app's dark theme.
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      richColors
      closeButton
      position="top-right"
      toastOptions={{ className: "border border-border" }}
      {...props}
    />
  );
}

export { Toaster };
