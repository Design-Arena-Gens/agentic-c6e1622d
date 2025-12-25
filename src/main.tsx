import "@/styles.css";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root element not found");
}

const root = createRoot(container);

const Root = () => {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js")
        .catch((error) => console.error("Service worker registration failed", error));
    }
  }, []);

  return (
    <StrictMode>
      <App />
    </StrictMode>
  );
};

root.render(<Root />);
