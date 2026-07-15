import { useEffect, useState, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

const IDLE_MS = 60_000;

// Rotas onde o screensaver NÃO deve aparecer (portaria opera direto).
const OPT_OUT_PREFIXES = ["/app/portaria"];

const MESES_PT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/**
 * SplitFlapDigit — dígito único no estilo painel de aeroporto.
 * Anima um "flip" 3D quando o valor muda.
 */
function SplitFlapDigit({ value }: { value: string }) {
  const [display, setDisplay] = useState(value);
  const [flipping, setFlipping] = useState(false);
  const prev = useRef(value);

  useEffect(() => {
    if (value !== prev.current) {
      setFlipping(true);
      const t = setTimeout(() => {
        setDisplay(value);
        setFlipping(false);
        prev.current = value;
      }, 250);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <div className="ss-digit">
      <div className="ss-digit-top"><span className="ss-glyph">{display}</span></div>
      <div className="ss-digit-bottom"><span className="ss-glyph">{display}</span></div>
      <div className="ss-digit-hinge" />
      <div className={`ss-digit-flap ${flipping ? "ss-flipping" : ""}`}>
        <div className="ss-digit-flap-front"><span className="ss-glyph">{display}</span></div>
        <div className="ss-digit-flap-back"><span className="ss-glyph ss-glyph-bottom">{value}</span></div>
      </div>
    </div>
  );
}

function SplitFlapGroup({ text }: { text: string }) {
  return (
    <div className="flex gap-1">
      {text.split("").map((ch, i) => (
        <SplitFlapDigit key={i} value={ch} />
      ))}
    </div>
  );
}

export function ScreenSaver() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [idle, setIdle] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [colonOn, setColonOn] = useState(true);
  const idleRef = useRef(false);

  const optedOut = OPT_OUT_PREFIXES.some((p) => pathname.startsWith(p));

  // Timer de inatividade: reset em qualquer evento de atividade.
  useEffect(() => {
    if (optedOut) {
      setIdle(false);
      idleRef.current = false;
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const armTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        idleRef.current = true;
        setIdle(true);
      }, IDLE_MS);
    };
    // Enquanto NÃO está ocioso: qualquer atividade reinicia a contagem.
    // Quando fica ocioso, só o ESC dispensa o screensaver.
    const onActivity = () => {
      if (idleRef.current) return;
      armTimer();
    };
    const onKey = (e: KeyboardEvent) => {
      if (idleRef.current) {
        if (e.key === "Escape") {
          idleRef.current = false;
          setIdle(false);
          armTimer();
        }
        return;
      }
      armTimer();
    };
    const activityEvents = ["mousemove", "mousedown", "scroll", "touchstart", "wheel"];
    activityEvents.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    window.addEventListener("keydown", onKey);
    armTimer();
    return () => {
      clearTimeout(timer);
      activityEvents.forEach((ev) => window.removeEventListener(ev, onActivity));
      window.removeEventListener("keydown", onKey);
    };
  }, [optedOut]);

  // Enquanto ativo, atualiza relógio a cada segundo. Fora disso, dorme.
  useEffect(() => {
    if (!idle) return;
    const tick = setInterval(() => {
      setNow(new Date());
      setColonOn((c) => !c);
    }, 1000);
    return () => clearInterval(tick);
  }, [idle]);

  if (!idle || optedOut) return null;

  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  const dd = pad(now.getDate());
  const mon = MESES_PT[now.getMonth()];
  const yy = pad(now.getFullYear() % 100);

  return (
    <div className="ss-overlay" role="presentation" aria-hidden="true">
      <div className="ss-panel">
        <div className="ss-row">
          <div className="ss-cell">
            <div className="ss-label">HORAS</div>
            <SplitFlapGroup text={hh} />
          </div>
          <div className={`ss-colon ${colonOn ? "on" : ""}`}>
            <span /><span />
          </div>
          <div className="ss-cell">
            <div className="ss-label">MIN</div>
            <SplitFlapGroup text={mm} />
          </div>
          <div className={`ss-colon ${colonOn ? "on" : ""}`}>
            <span /><span />
          </div>
          <div className="ss-cell">
            <div className="ss-label">SEG</div>
            <SplitFlapGroup text={ss} />
          </div>
        </div>
        <div className="ss-row ss-row-date">
          <div className="ss-cell">
            <div className="ss-label">DIA</div>
            <SplitFlapGroup text={dd} />
          </div>
          <div className="ss-cell">
            <div className="ss-label">MÊS</div>
            <SplitFlapGroup text={mon} />
          </div>
          <div className="ss-cell">
            <div className="ss-label">ANO</div>
            <SplitFlapGroup text={yy} />
          </div>
        </div>
        <div className="ss-hint">Mova o mouse ou toque em qualquer tecla para continuar</div>
      </div>
    </div>
  );
}