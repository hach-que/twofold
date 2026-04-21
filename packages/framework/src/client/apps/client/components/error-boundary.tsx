import { Component, ReactNode } from "react";
import { DevErrorPage, ProdErrorPage } from "./error-pages";
import * as Sentry from "@sentry/react";

export class ErrorBoundary extends Component<
  { children?: ReactNode },
  {
    hasError: boolean;
    error: unknown;
    capturedExceptionId?: string;
  }
> {
  constructor(props: object) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      error,
      hasError: true,
    };
  }

  componentDidCatch(error: unknown, errorInfo: any) {
    this.setState({
      capturedExceptionId: Sentry.captureReactException(error, errorInfo),
    });
  }

  onPopState = (_event: PopStateEvent) => {
    if (this.state.hasError) {
      window.location.reload();
    }
  };

  componentDidMount(): void {
    window.addEventListener("popstate", this.onPopState);
  }

  componentWillUnmount(): void {
    window.removeEventListener("popstate", this.onPopState);
  }

  reset() {
    this.setState({
      hasError: false,
      error: null,
    });
  }

  render() {
    if (this.state.hasError) {
      let error = this.state.error;
      if (
        typeof error === "object" &&
        error !== undefined &&
        error !== null &&
        (!("digest" in error) || typeof error.digest !== "string")
      ) {
        let sentryTraceId = Sentry.getActiveSpan()?.spanContext().traceId;
        if (sentryTraceId) {
          (error as any).digest = this.state.capturedExceptionId;
        } else if (this.state.capturedExceptionId) {
          (error as any).digest = "ex-" + this.state.capturedExceptionId;
        }
      }

      return process.env.NODE_ENV === "production" ? (
        <ProdErrorPage error={error} />
      ) : (
        <DevErrorPage error={error} />
      );
    }

    return this.props.children;
  }
}
