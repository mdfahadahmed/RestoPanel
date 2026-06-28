import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GRADIENTS: Record<string, string> = {
  violet: "from-violet-500/30 to-violet-400/80",
  sky: "from-sky-500/30 to-sky-400/80",
  emerald: "from-emerald-500/30 to-emerald-400/80",
  gold: "from-gold-500/30 to-gold-400/80",
};

export function BarChart({
  title,
  data,
  color = "violet",
  format = (n) => String(n),
  height = "h-44",
}: {
  title: string;
  data: { label: string; value: number }[];
  color?: keyof typeof GRADIENTS;
  format?: (n: number) => string;
  height?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  const showEveryNthLabel = Math.ceil(data.length / 12);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <span className="text-sm font-normal text-fog-500">{format(total)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className={`grid ${height} place-items-center text-sm text-fog-600`}>No data for this period</div>
        ) : (
          <div className={`flex ${height} items-end gap-1`}>
            {data.map((d, i) => (
              <div key={`${d.label}-${i}`} className="group flex flex-1 flex-col items-center gap-1.5">
                <div className="relative flex w-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t bg-gradient-to-t ${GRADIENTS[color]}`}
                    style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
                    title={`${d.label}: ${format(d.value)}`}
                  />
                </div>
                <span className="h-3 text-[9px] text-fog-600">
                  {i % showEveryNthLabel === 0 ? d.label.split(" ")[0] : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function HBarList({
  title,
  rows,
  format,
}: {
  title: string;
  rows: { name: string; value: number; sub?: string }[];
  format: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="grid h-32 place-items-center text-sm text-fog-600">No data for this period</div>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="truncate text-fog-200">{r.name}</span>
                  <span className="shrink-0 text-fog-400">
                    {format(r.value)}
                    {r.sub && <span className="ml-1.5 text-xs text-fog-600">{r.sub}</span>}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-gold-500/60 to-gold-400" style={{ width: `${(r.value / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
