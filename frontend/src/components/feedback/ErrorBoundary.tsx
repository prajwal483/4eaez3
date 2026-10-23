import { Component, type ErrorInfo, type ReactNode } from "react";
import s from "./ErrorBoundary.module.css";

interface State {
  error: Error | null;
}

/** Keeps a rendering bug in one view from blanking the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={s.boundary} role="alert">
        <h2 className={s.title}>Something went wrong on this page.</h2>
        <p>Reload to try again. If it keeps happening, the details are in the browser console.</p>
        <button type="button" className={s.reload} onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
