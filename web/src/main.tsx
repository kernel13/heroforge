import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { I18nProvider } from "./i18n";
/* The self-hosted display faces. Here rather than in styles.css because Tailwind resolves that
   file's `@import`s itself and cannot read a bare package specifier; see the note there. */
import "@fontsource/cinzel/500.css";
import "@fontsource/cinzel/700.css";
import "@fontsource/medievalsharp/400.css";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

const root = document.getElementById("root");
if (root === null) throw new Error("no #root element");

createRoot(root).render(
  <StrictMode>
    {/* Outside the query client: the sign-in form, the "could not reach the server" message, and
        every loading state have to be readable before any request has succeeded. */}
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </I18nProvider>
  </StrictMode>,
);
