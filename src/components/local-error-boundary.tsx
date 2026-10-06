import { Component, type ReactNode } from "react";

/** Segura erro de um pedaço da tela sem derrubar a página inteira. */
export class LocalErrorBoundary extends Component<
  { children: ReactNode; onReset?: () => void; label?: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error("[LocalErrorBoundary]", this.props.label, error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4">
        <div className="max-w-md rounded-xl border border-destructive/40 bg-card p-5 text-sm space-y-3">
          <div className="font-black text-destructive">Não foi possível abrir {this.props.label ?? "o documento"}</div>
          <div className="text-xs text-muted-foreground break-words">{this.state.error.message}</div>
          <button
            className="rounded-md border border-border px-3 py-1.5 text-xs font-bold"
            onClick={() => { this.setState({ error: null }); this.props.onReset?.(); }}
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }
}
