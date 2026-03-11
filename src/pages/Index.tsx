import { useEffect, useMemo, useState } from "react";

const API_BASE =
  "https://script.google.com/macros/s/AKfycbyPsbmnfUDww57eduE8vHuk61s1pf3aB5i3Lx8hddeKmupnJWKylj9C60QEIoJ1Vuo_7g/exec";

type Row = Record<string, any> & { error?: string };

function num(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  const s = String(v)
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function fmtInt(v: number | null) {
  return v == null ? "—" : v.toLocaleString("es-ES");
}

function fmtEUR(v: number | null) {
  return v == null
    ? "—"
    : v.toLocaleString("es-ES", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      });
}

function fmtEURm2(v: number | null) {
  return v == null ? "—" : `${v.toLocaleString("es-ES")} €/m²`;
}

const COLORS = {
  bg: "#070B12",
  panel: "#0B1020",
  border: "rgba(255,255,255,0.08)",
  text: "#E7EAF0",
  muted: "rgba(231,234,240,0.65)",
  accent: "#2F49FF",
  accentSoft: "rgba(47,73,255,0.14)",
  accent2: "#5B6CFF",
  rowHover: "rgba(255,255,255,0.03)",
};

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: any;
}) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        background: COLORS.panel,
        borderRadius: 14,
        padding: 14,
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        minWidth: 220,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 12, letterSpacing: 0.8, color: COLORS.muted }}>
          {title.toUpperCase()}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 12, color: "rgba(231,234,240,0.45)" }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

export default function Index() {
  const [provincias, setProvincias] = useState<string[]>([]);
  const [provincia, setProvincia] = useState<string>("Madrid");

  const [municipios, setMunicipios] = useState<string[]>([]);
  const [municipio, setMunicipio] = useState<string>("");

  const [data, setData] = useState<Row | null>(null);
  const [tablaProvincia, setTablaProvincia] = useState<Row[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingTabla, setLoadingTabla] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 1) cargar provincias
  useEffect(() => {
    fetch(`${API_BASE}?provincias=1`)
      .then((r) => r.json())
      .then((json) => {
        const list = (json?.provincias || []).map((p: string) => String(p).trim());
        setProvincias(list);
        if (list.length && !list.includes(provincia)) setProvincia(list[0]);
      })
      .catch(() => setProvincias(["Madrid"]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) cargar municipios al cambiar provincia
  useEffect(() => {
    if (!provincia) return;

    setMunicipios([]);
    setMunicipio("");
    setData(null);

    fetch(`${API_BASE}?municipios=1&provincia=${encodeURIComponent(provincia)}`)
      .then((r) => r.json())
      .then((json) => {
        const list = (json?.municipios || []).map((m: string) => String(m).trim());
        setMunicipios(list);
        if (list.length) setMunicipio(list[0]);
      })
      .catch(() => setMunicipios([]));
  }, [provincia]);

  // 3) cargar detalle al cambiar municipio
  useEffect(() => {
    if (!provincia || !municipio) return;

    setLoading(true);
    setErr(null);

    fetch(
      `${API_BASE}?provincia=${encodeURIComponent(provincia)}&municipio=${encodeURIComponent(
        municipio
      )}`
    )
      .then((r) => r.json())
      .then((json: Row) => {
        if (json?.error) throw new Error(json.error);
        setData(json);
      })
      .catch((e) => {
        setData(null);
        setErr(e?.message || "Error cargando datos");
      })
      .finally(() => setLoading(false));
  }, [provincia, municipio]);

  // 4) cargar tabla resumen por provincia
  useEffect(() => {
    if (!provincia) return;

    setLoadingTabla(true);

    fetch(`${API_BASE}?tabla=1&provincia=${encodeURIComponent(provincia)}`)
      .then((r) => r.json())
      .then((json) => {
        setTablaProvincia(json?.items || []);
      })
      .catch(() => setTablaProvincia([]))
      .finally(() => setLoadingTabla(false));
  }, [provincia]);

  // métricas del municipio seleccionado
  const dens2025 = num(data?.["Densidad 2025"]);
  const dens2022 = num(data?.["Densidad 2022"]);

  // OJO: si tu API devuelve dos columnas "Renta", puede quedarse con la última.
  // Por ahora usamos la que llegue.
  const renta = num(data?.["Renta"]);
  const clubes = num(data?.["Clubes"]);
  const precioSueloNum = num(data?.["Precio suelo n"]) ?? num(data?.["Precio suelo"]);
  const habPorClub = num(data?.["Habitantes por club"]);
  const indice = num(data?.["Indice"]) ?? num(data?.["Índice"]);

  const densDelta = useMemo(() => {
    if (dens2025 == null || dens2022 == null || dens2022 === 0) return null;
    return ((dens2025 - dens2022) / dens2022) * 100;
  }, [dens2025, dens2022]);

  const maxD = useMemo(() => Math.max(dens2025 ?? 0, dens2022 ?? 0), [dens2025, dens2022]);

  const tablaOrdenada = useMemo(() => {
    return [...tablaProvincia].sort((a, b) => {
      const aVal = num(a["Habitantes por club"]) ?? -Infinity;
      const bVal = num(b["Habitantes por club"]) ?? -Infinity;
      return bVal - aVal;
    });
  }, [tablaProvincia]);

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        margin: 0,
        padding: 0,
        background: `radial-gradient(1100px 600px at 18% 0%, rgba(47,73,255,0.22), transparent 60%),
                     radial-gradient(900px 500px at 92% 8%, rgba(91,108,255,0.14), transparent 55%),
                     ${COLORS.bg}`,
        color: COLORS.text,
        fontFamily: "system-ui",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 18px 40px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src="/padelitic-logo.png"
              alt="Padeltic"
              style={{ height: 34, width: "auto" }}
            />
            <div>
              <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 0.2 }}>
                Investment Dashboard
              </h1>
              <div style={{ color: COLORS.muted, marginTop: 6, fontSize: 13 }}>
                Provincia → Municipio
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={provincia}
              onChange={(e) => setProvincia(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.panel,
                color: COLORS.text,
                outline: "none",
                minWidth: 220,
              }}
            >
              {provincias.map((p) => (
                <option key={p} value={p}>
                  {String(p).toUpperCase()}
                </option>
              ))}
            </select>

            <select
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.panel,
                color: COLORS.text,
                outline: "none",
                minWidth: 260,
              }}
              disabled={!municipios.length}
            >
              {municipios.length ? (
                municipios.map((m) => (
                  <option key={m} value={m}>
                    {String(m).toUpperCase()}
                  </option>
                ))
              ) : (
                <option value="">(sin municipios)</option>
              )}
            </select>
          </div>
        </div>

        {/* Status */}
        <div style={{ marginTop: 14, marginBottom: 12 }}>
          {loading && <div style={{ color: COLORS.muted, fontSize: 13 }}>Cargando municipio…</div>}
          {err && <div style={{ color: "#ff95a7", fontSize: 13 }}>{err}</div>}
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
          <div style={{ gridColumn: "span 4" }}>
            <Card title="Densidad 2025">
              <div style={{ fontSize: 28, fontWeight: 850 }}>{fmtInt(dens2025)}</div>
            </Card>
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <Card title="Renta">
              <div style={{ fontSize: 28, fontWeight: 850 }}>{fmtEUR(renta)}</div>
            </Card>
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <Card title="Clubes">
              <div style={{ fontSize: 28, fontWeight: 850 }}>
                {clubes == null ? "—" : clubes}
              </div>
            </Card>
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <Card title="Precio suelo" subtitle="€/m²">
              <div style={{ fontSize: 28, fontWeight: 850 }}>{fmtEURm2(precioSueloNum)}</div>
            </Card>
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <Card title="Habitantes por club">
              <div style={{ fontSize: 28, fontWeight: 850 }}>{fmtInt(habPorClub)}</div>
            </Card>
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <Card title="Índice">
              <div style={{ fontSize: 28, fontWeight: 850 }}>
                {indice == null ? "—" : indice.toFixed(2)}
              </div>
            </Card>
          </div>

          <div style={{ gridColumn: "span 12" }}>
            <Card title="Variación densidad" subtitle="2025 vs 2022">
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "baseline" }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 850 }}>{fmtInt(dens2025)}</div>
                  <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 6 }}>
                    Densidad 2025
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 850 }}>{fmtInt(dens2022)}</div>
                  <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 6 }}>
                    Densidad 2022
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 850 }}>
                    {densDelta == null ? "—" : `${densDelta >= 0 ? "+" : ""}${densDelta.toFixed(1)}%`}
                  </div>
                  <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 6 }}>
                    Variación
                  </div>
                </div>
              </div>

              {dens2025 != null && dens2022 != null ? (
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  {[
                    { label: "Densidad 2025", value: dens2025, color: COLORS.accent },
                    { label: "Densidad 2022", value: dens2022, color: "rgba(231,234,240,0.35)" },
                  ].map((b) => {
                    const w = maxD > 0 ? (b.value / maxD) * 100 : 0;
                    return (
                      <div
                        key={b.label}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "140px 1fr 120px",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <div style={{ fontSize: 12, color: COLORS.muted }}>{b.label}</div>
                        <div
                          style={{
                            height: 10,
                            borderRadius: 999,
                            background: "rgba(0,0,0,0.25)",
                            border: `1px solid ${COLORS.border}`,
                            overflow: "hidden",
                          }}
                        >
                          <div style={{ width: `${w}%`, height: "100%", background: b.color }} />
                        </div>
                        <div style={{ textAlign: "right", fontSize: 12 }}>
                          {b.value.toLocaleString("es-ES")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </Card>
          </div>
        </div>

        {/* Tabla resumen por provincia */}
        <div style={{ marginTop: 18 }}>
          <Card title={`Resumen ${provincia}`} subtitle="Municipios de la provincia">
            <div style={{ marginBottom: 12, color: COLORS.muted, fontSize: 13 }}>
              {loadingTabla
                ? "Cargando tabla…"
                : `${tablaOrdenada.length} municipios cargados`}
            </div>

            <div
              style={{
                overflowX: "auto",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 14,
                  color: COLORS.text,
                  minWidth: 900,
                }}
              >
                <thead
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    position: "sticky",
                    top: 0,
                  }}
                >
                  <tr style={{ textAlign: "left" }}>
                    <th style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.border}` }}>
                      Municipio
                    </th>
                    <th style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.border}` }}>
                      Habitantes por club
                    </th>
                    <th style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.border}` }}>
                      Precio suelo
                    </th>
                    <th style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.border}` }}>
                      Renta
                    </th>
                    <th style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.border}` }}>
                      % Ocupación
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {tablaOrdenada.map((row, i) => {
                    const isSelected =
                      String(row["MUNICIPIO"] || "").trim().toUpperCase() ===
                      String(municipio || "").trim().toUpperCase();

                    const habClub = num(row["Habitantes por club"]);
                    const precio =
                      num(row["Precio suelo n"]) ?? num(row["Precio suelo"]);
                    const rentaRow = num(row["Renta"]);
                    const ocup = num(row["% Ocupacion"]);

                    return (
                      <tr
                        key={`${row["MUNICIPIO"]}-${i}`}
                        style={{
                          background: isSelected ? COLORS.accentSoft : "transparent",
                          borderBottom: `1px solid ${COLORS.border}`,
                        }}
                      >
                        <td style={{ padding: "12px 14px", fontWeight: isSelected ? 700 : 500 }}>
                          {row["MUNICIPIO"]}
                        </td>
                        <td style={{ padding: "12px 14px" }}>{fmtInt(habClub)}</td>
                        <td style={{ padding: "12px 14px" }}>{fmtEURm2(precio)}</td>
                        <td style={{ padding: "12px 14px" }}>{fmtEUR(rentaRow)}</td>
                        <td style={{ padding: "12px 14px" }}>
                          {ocup == null ? "—" : `${Math.round(ocup * 100)}%`}
                        </td>
                      </tr>
                    );
                  })}

                  {!tablaOrdenada.length && !loadingTabla && (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          padding: "16px 14px",
                          color: COLORS.muted,
                          textAlign: "center",
                        }}
                      >
                        No hay datos para esta provincia.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}