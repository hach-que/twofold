import { Stylesheet } from "./stylesheet";
import { ErrorViewer } from "../../errors/error-viewer";
import * as Sentry from "@sentry/react";

export function DevErrorPage({ error }: { error: unknown }) {
  return (
    <html>
      <head>
        <link rel="icon" href="data:;base64,iVBORw0KGgo=" />
        <Stylesheet href="/_twofold/errors/app.css" />
      </head>
      <body>
        <ErrorViewer error={error} />
      </body>
    </html>
  );
}

export function ProdErrorPage({ error }: { error: unknown }) {
  let digest =
    error instanceof Error &&
    "digest" in error &&
    typeof error.digest === "string"
      ? error.digest
      : (Sentry.getActiveSpan()?.spanContext().traceId ?? "");

  let html = `${process.env.TWOFOLD_PROD_ERROR_HTML}`
    .replace("$digest-class", digest ? "" : "hidden")
    .replace("$digest", digest);

  return <html dangerouslySetInnerHTML={{ __html: html }} />;
}
