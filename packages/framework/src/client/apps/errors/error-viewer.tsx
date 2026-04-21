import { ReactNode, use, useEffect } from "react";
import StackTrace from "stacktrace-js";
import { Suspense } from "react";
import * as Sentry from "@sentry/react";

export function ErrorRendererLoaded(props: {
  error: Error;
  stacktrace: Promise<StackTrace.StackFrame[]>;
}) {
  const stacktrace = use(props.stacktrace);

  const lines: ReactNode[] = [];
  for (const frame of stacktrace) {
    const url = new URL(frame.getFileName());
    const line = `${frame.getFunctionName()} @ ${decodeURI(frame.getFileName())}:${frame.getLineNumber()}:${frame.getColumnNumber()}\n`;
    if (url.pathname.startsWith("/__tf/")) {
      lines.push(<span style={{ opacity: "40%" }}>{line}</span>);
    } else {
      lines.push(line);
    }
  }

  return (
    <>
      <p className="text-red-500 text-xl">{props.error.message}</p>
      <pre className="mt-6 overflow-x-scroll pr-6 -mr-6 text-sm">{lines}</pre>
    </>
  );
}

export function ErrorRenderer({ error }: { error: Error }) {
  const stacktrace = StackTrace.fromError(error);

  return (
    <Suspense
      fallback={
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      }
    >
      <ErrorRendererLoaded error={error} stacktrace={stacktrace} />
    </Suspense>
  );
}

export function ErrorViewer({ error }: { error: unknown }) {
  let digest =
    error instanceof Error &&
    "digest" in error &&
    typeof error.digest === "string"
      ? error.digest
      : Sentry.getActiveSpan()?.spanContext().traceId;

  return (
    <div className="bg-red-50 h-full">
      <div className="p-6 max-w-7xl mx-auto h-full">
        <div className="rounded shadow border border-gray-300 p-6 bg-white">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Error</h1>
          </div>
          <div className="mt-6">
            {error instanceof Error ? (
              <ErrorRenderer error={error} />
            ) : (
              <p className="text-red-500 text-xl">Unknown error</p>
            )}
          </div>
          {digest ? <p className="mt-6">Trace ID: {digest}</p> : null}
        </div>
      </div>

      <Reload />
    </div>
  );
}

function Reload() {
  useEffect(() => {
    let eventSource = new EventSource("/__dev/reload");

    eventSource.onmessage = (e) => {
      let data = JSON.parse(e.data);
      if (data.type === "changes") {
        window.location.reload();
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return null;
}
