// Entry point: shows the landing page for training-email links (/caught, /reported), otherwise the app

import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { CaughtPage } from "./app/components/CaughtPage";
import { Toaster } from "./app/components/ui/sonner";
import "./styles/index.css";

const path = window.location.pathname.replace(/\/$/, "");
const landing = path.endsWith("/caught") ? "caught" : path.endsWith("/reported") ? "reported" : null;

createRoot(document.getElementById("root")!).render(
  <>
    {landing ? <CaughtPage variant={landing} /> : <App />}
    <Toaster />
  </>,
);
