import { RouteHandler } from "@hattip/router";
import { serializeError } from "serialize-error";
import { Build } from "../../build/build/build.js";
import { readFile } from "fs/promises";
import { appCompiledDir } from "../../files.js";
import { parseHeaderValue } from "@hattip/headers";
import {
  renderToReadableStream,
  // @ts-expect-error: TypeScript cannot find type declarations for this module
} from "react-server-dom-webpack/server.edge";
import * as Sentry from "@sentry/node";

export function errors(build: Build): RouteHandler {
  return async (ctx) => {
    ctx.handleError = async (e: unknown) => {
      let request = ctx.request;

      if (Sentry.isEnabled()) {
        Sentry.captureException(e);
      }

      let accepts = parseHeaderValue(request.headers.get("accept"));
      let isRSCFetch = accepts.some((a) => a.value === "text/x-component");
      let isHTMLFetch = accepts.some((a) => a.value === "text/html");

      let error = e instanceof Error ? e : new Error("Internal server error");

      let status =
        "digest" in error &&
        typeof error.digest === "string" &&
        error.digest === "TwofoldNotFoundError"
          ? 404
          : 500;

      if (isRSCFetch) {
        // maybe let the runtime own this?
        let stream = renderToReadableStream(
          {
            stack: [
              {
                type: "error",
                error: error,
              },
            ],
          },
          {},
        );
        let headers: HeadersInit = {
          "content-type": "text/x-component",
        };
        if (
          error instanceof Error &&
          "digest" in error &&
          typeof error.digest === "string"
        ) {
          // provide the digest ID as a header, since React will omit it when serializing the error in the RSC stream
          headers["x-twofold-error-digest"] = error.digest;
        } else {
          let sentryTraceId = Sentry.getActiveSpan()?.spanContext().traceId;
          if (sentryTraceId) {
            headers["x-twofold-error-digest"] = sentryTraceId;
          }
        }
        return new Response(stream, {
          status,
          headers: headers,
        });
      } else if (isHTMLFetch) {
        let html = await errorPage(error);
        return new Response(html, {
          status,
          headers: {
            "content-type": "text/html",
          },
        });
      } else {
        let text = `${error.message}\n\n${error.stack}`;
        return new Response(text, {
          status,
          headers: {
            "content-type": "text/plain",
          },
        });
      }
    };

    if (build.name === "development") {
      let request = ctx.request;
      let url = new URL(request.url);

      if (
        request.method === "GET" &&
        url.pathname === "/_twofold/errors/app.js"
      ) {
        let contents = await build.getBuilder("dev-error-page").js();
        return new Response(contents, {
          headers: {
            "content-type": "application/javascript",
          },
        });
      }

      if (
        request.method === "GET" &&
        url.pathname === "/_twofold/errors/app.css"
      ) {
        let contents = await build.getBuilder("dev-error-page").css();
        return new Response(contents, {
          headers: {
            "content-type": "text/css",
          },
        });
      }
    }

    if (build.error) {
      throw build.error;
    }
  };
}

export async function errorPage(error: Error) {
  let htmlFile = new URL("./server-files/error.html", appCompiledDir);
  let contents = await readFile(htmlFile, "utf-8");

  let isProd = process.env.NODE_ENV === "production";

  let serializedError = isProd ? "" : JSON.stringify(serializeError(error));
  let message = isProd ? "" : error.message;
  let stack = isProd ? "" : (error.stack ?? "");

  let digest =
    error instanceof Error &&
    "digest" in error &&
    typeof error.digest === "string"
      ? error.digest
      : (Sentry.getActiveSpan()?.spanContext().traceId ?? "");

  let html = contents
    .replace("$error", serializedError)
    .replace("$message", message)
    .replace("$stack", stack)
    .replace("$digest-class", digest ? "" : "hidden")
    .replace("$digest", digest);

  return html;
}
