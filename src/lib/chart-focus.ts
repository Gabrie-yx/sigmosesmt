// Helpers de "focus mode" (renormalização visual) para gráficos de barra.
// Quando uma categoria é selecionada, ela vira a referência (100%) e as demais
// são escaladas para ficarem visualmente MENORES — mesmo que no valor real
// sejam maiores. O valor real continua disponível em `__real_<chave>` para
// labels e tooltips.

export type FocusScaleOptions<T> = {
  labelKey: keyof T;
  valueKeys: (keyof T)[];
  selected: string | null;
  /** Fração máxima do valor selecionado que as outras barras podem ocupar (0–1). */
  cap?: number;
};

export function focusScale<T extends Record<string, any>>(
  data: T[],
  opts: FocusScaleOptions<T>,
): T[] {
  const { labelKey, valueKeys, selected, cap = 0.55 } = opts;
  // Sempre injeta valores reais p/ label/tooltip
  const withReal = data.map((row) => {
    const r: any = { ...row };
    for (const k of valueKeys) r[`__real_${String(k)}`] = Number(row[k]) || 0;
    return r as T & Record<string, number>;
  });
  if (!selected) return withReal;

  const totalOf = (row: any) =>
    valueKeys.reduce((s, k) => s + (Number(row[`__real_${String(k)}`]) || 0), 0);

  const sel = withReal.find((d) => String(d[labelKey]) === selected);
  if (!sel) return withReal;
  const selTotal = totalOf(sel) || 1;

  const others = withReal.filter((d) => String(d[labelKey]) !== selected);
  const otherMax = Math.max(1, ...others.map(totalOf));
  const targetCap = selTotal * cap;
  const k = targetCap / otherMax;

  return withReal.map((row) => {
    if (String(row[labelKey]) === selected) return row;
    const next: any = { ...row };
    for (const vk of valueKeys) {
      next[vk] = (Number(row[`__real_${String(vk)}`]) || 0) * k;
    }
    return next;
  });
}

/** Toggle de seleção: clique no mesmo item desseleciona. */
export const toggleFocus =
  (setFn: (v: string | null) => void, current: string | null) => (label: string) => {
    setFn(current === label ? null : label);
  };