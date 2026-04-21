import "../ext/react-refresh";
import "../ext/webpack-loaders";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserApp } from "./browser-app";
import { Component, startTransition, StrictMode } from "react";
import * as Sentry from "@sentry/react";

declare global {
  interface Window {
    SSRDidError?: boolean;
    SentryConfig?: Sentry.BrowserOptions;
  }
}

function main() {
  if (window.SentryConfig) {
    Sentry.init({
      ...window.SentryConfig,
      integrations: [Sentry.browserTracingIntegration()],
    });
  }

  let tree = (
    <StrictMode>
      <BrowserApp />
    </StrictMode>
  );

  if (!window.SSRDidError) {
    startTransition(() => {
      hydrateRoot(document, tree, {
        onCaughtError,
      });
    });
  } else {
    // we have a bad ssr stream and we dont want to attempt to hydrate anything
    // lets render what we have and let the client app use its error
    // boundaries to catch
    let root = createRoot(document, {
      onCaughtError,
    });
    startTransition(() => {
      root.render(tree);
    });
  }
}

if (typeof window !== "undefined") {
  main();
}

type ErrorInfo = {
  componentStack?: string | undefined;
  errorBoundary?: Component<unknown, object, any> | undefined;
};

function onCaughtError(error: unknown, errorInfo: ErrorInfo) {
  let isSafeError =
    isRedirectError(error) ||
    isNotFoundError(error) ||
    isUnauthorizedError(error);

  let errorBoundaryName = errorInfo.errorBoundary?.constructor.name;

  if (!isSafeError && process.env.NODE_ENV !== "production") {
    // Let's redisplay the normal react error message here.
    //
    // This is taken from: https://github.com/facebook/react/blob/65eec428c40d542d4d5a9c1af5c3f406aecf3440/packages/react-reconciler/src/ReactFiberErrorLogger.js#L60

    console.error(
      "%o\n\n%s",
      error,
      errorBoundaryName
        ? `The error was handled by the ${errorBoundaryName} error boundary.`
        : "The error was caught by React",
    );
  }

  // Only report here if there was no error boundary handling it,
  // as error boundaries should call captureReactException.
  if (!isSafeError && errorBoundaryName === undefined) {
    Sentry.captureReactException(error, errorInfo as any);
  }
}

function isNotFoundError(err: unknown) {
  return (
    err instanceof Error &&
    "digest" in err &&
    typeof err.digest === "string" &&
    err.digest === "TwofoldNotFoundError"
  );
}

function isRedirectError(err: unknown) {
  return (
    err instanceof Error &&
    "digest" in err &&
    typeof err.digest === "string" &&
    err.digest.startsWith("TwofoldRedirectError")
  );
}

function isUnauthorizedError(err: unknown) {
  return (
    err instanceof Error &&
    "digest" in err &&
    typeof err.digest === "string" &&
    err.digest.startsWith("TwofoldUnauthorizedError")
  );
}
