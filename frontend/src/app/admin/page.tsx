'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api/client';
import PageHeader from '@/components/admin/PageHeader';
import styles from './page.module.css';

interface Stats {
  cursos_por_estado: Record<string, number>;
  usuarios: number;
  alumnos: number;
  organizaciones: number;
  embudo: { inscritos: number; sin_iniciar: number; en_curso: number; terminaron: number; certificados: number };
  semanas: { inicio: string; inscripciones: number; lecciones_completadas: number }[];
  top_cursos: { id: string; titulo: string; inscritos: number; terminaron: number; avance_promedio: number }[];
  por_organizacion: { id: string; nombre: string; alumnos: number; inscripciones: number; avance_promedio: number }[];
}

const n = (v: number) => v.toLocaleString('es-MX');
const pct = (a: number, b: number) => (b > 0 ? Math.round((100 * a) / b) : 0);
const semanaCorta = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });

/* ── Avance de los alumnos: cifras por etapa y una barra dividida ────── */
function Embudo({ e }: { e: Stats['embudo'] }) {
  const etapas = [
    { key: 'sin', label: 'Sin iniciar', value: e.sin_iniciar, cls: styles.segIdle },
    { key: 'curso', label: 'En curso', value: e.en_curso, cls: styles.segActive },
    { key: 'fin', label: 'Terminaron', value: e.terminaron, cls: styles.segDone },
  ];
  const total = Math.max(1, e.inscritos);
  return (
    <section className={`${styles.panel} ${styles.board}`} aria-labelledby="avance-titulo">
      <div className={styles.panelHead}>
        <div>
          <h2 id="avance-titulo" className={styles.panelTitle}>Avance de los alumnos</h2>
          <p className={styles.boardSub}>{n(e.inscritos)} inscripciones vigentes en todos los cursos</p>
        </div>
      </div>
      <dl className={styles.stats}>
        {etapas.map((s) => (
          <div key={s.key} className={styles.stat}>
            <dt><i className={`${styles.swatch} ${s.cls}`} aria-hidden="true" />{s.label}</dt>
            <dd>
              <span className={styles.statNum}>{n(s.value)}</span>
              <span className={styles.statPct}>{pct(s.value, total)}%</span>
            </dd>
          </div>
        ))}
        <div className={`${styles.stat} ${styles.statCert}`}>
          <dt>Certificados emitidos</dt>
          <dd><span className={styles.statNum}>{n(e.certificados)}</span></dd>
        </div>
      </dl>
      <div className={styles.rail} role="img" aria-label={etapas.map((s) => `${s.label}: ${pct(s.value, total)}%`).join(', ')}>
        {etapas.map((s) => (
          <div key={s.key} className={`${styles.seg} ${s.cls}`} style={{ flexGrow: Math.max(s.value, total * 0.02) }} />
        ))}
      </div>
    </section>
  );
}

/* ── Actividad semanal: columnas (lecciones) + línea (inscripciones) ───── */
function Actividad({ semanas }: { semanas: Stats['semanas'] }) {
  const W = 640, H = 220, L = 34, R = 34, T = 14, B = 28;
  const iw = W - L - R, ih = H - T - B;
  const maxLec = Math.max(4, ...semanas.map((s) => s.lecciones_completadas));
  const maxIns = Math.max(4, ...semanas.map((s) => s.inscripciones));
  const step = iw / semanas.length;
  const bw = Math.min(26, step * 0.56);
  const yL = (v: number) => T + ih - (ih * v) / maxLec;
  const yI = (v: number) => T + ih - (ih * v) / maxIns;
  const ticks = [0, 0.5, 1].map((f) => Math.round(maxLec * f));
  const linea = semanas.map((s, i) => `${L + step * i + step / 2},${yI(s.inscripciones)}`).join(' ');
  const ultima = semanas[semanas.length - 1];
  const totalLec = semanas.reduce((a, s) => a + s.lecciones_completadas, 0);
  const totalIns = semanas.reduce((a, s) => a + s.inscripciones, 0);

  return (
    <section className={styles.panel} aria-labelledby="actividad-titulo">
      <div className={styles.panelHead}>
        <h2 id="actividad-titulo" className={styles.panelTitle}>Actividad de las últimas 12 semanas</h2>
        <div className={styles.keys}>
          <span><i className={`${styles.key} ${styles.keyBar}`} aria-hidden="true" />Lecciones completadas</span>
          <span><i className={`${styles.key} ${styles.keyLine}`} aria-hidden="true" />Inscripciones nuevas</span>
        </div>
      </div>
      <div className={styles.chartWrap}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img"
          aria-label={`En 12 semanas: ${totalLec} lecciones completadas y ${totalIns} inscripciones nuevas. Esta semana: ${ultima?.lecciones_completadas ?? 0} lecciones y ${ultima?.inscripciones ?? 0} inscripciones.`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={yL(t)} y2={yL(t)} className={styles.grid} />
              <text x={L - 8} y={yL(t) + 4} className={styles.axis} textAnchor="end">{t}</text>
            </g>
          ))}
          {[0, 0.5, 1].map((f) => (
            <text key={f} x={W - R + 8} y={yI(maxIns * f) + 4} className={`${styles.axis} ${styles.axisLine}`}>{Math.round(maxIns * f)}</text>
          ))}
          {semanas.map((s, i) => {
            const x = L + step * i + (step - bw) / 2;
            const y = yL(s.lecciones_completadas);
            const actual = i === semanas.length - 1;
            return (
              <g key={s.inicio}>
                <rect x={x} y={y} width={bw} height={Math.max(0, T + ih - y)} rx={2}
                  className={actual ? styles.barNow : styles.bar}>
                  <title>{`Semana del ${semanaCorta.format(new Date(s.inicio + 'T12:00:00'))}: ${s.lecciones_completadas} lecciones, ${s.inscripciones} inscripciones`}</title>
                </rect>
                {(i % 2 === 1 || actual) && (
                  <text x={L + step * i + step / 2} y={H - 8} textAnchor="middle" className={styles.axis}>
                    {actual ? 'Esta semana' : semanaCorta.format(new Date(s.inicio + 'T12:00:00'))}
                  </text>
                )}
              </g>
            );
          })}
          <polyline points={linea} className={styles.line} />
          {semanas.map((s, i) => (
            <circle key={s.inicio} cx={L + step * i + step / 2} cy={yI(s.inscripciones)} r={i === semanas.length - 1 ? 4 : 2.5} className={styles.dot} />
          ))}
        </svg>
      </div>
    </section>
  );
}

/* ── Catálogo: anillo por estado de curso ──────────────────────────────── */
function Catalogo({ porEstado }: { porEstado: Record<string, number> }) {
  const orden = [
    { key: 'publicado', label: 'Publicados', cls: styles.ringPub },
    { key: 'revision', label: 'En revisión', cls: styles.ringRev },
    { key: 'borrador', label: 'Borradores', cls: styles.ringDraft },
    { key: 'rechazado', label: 'Rechazados', cls: styles.ringRej },
  ].filter((o) => (porEstado[o.key] ?? 0) > 0);
  const total = Object.values(porEstado).reduce((a, b) => a + b, 0);
  const r = 46, c = 2 * Math.PI * r;
  let acc = 0;
  const revision = porEstado.revision ?? 0;

  return (
    <section className={styles.panel} aria-labelledby="catalogo-titulo">
      <div className={styles.panelHead}>
        <h2 id="catalogo-titulo" className={styles.panelTitle}>Catálogo</h2>
        <Link href="/admin/cursos" className={styles.link}>Ver cursos</Link>
      </div>
      <div className={styles.catalog}>
        <svg viewBox="0 0 120 120" className={styles.ring} role="img"
          aria-label={orden.map((o) => `${o.label}: ${porEstado[o.key]}`).join(', ')}>
          <circle cx="60" cy="60" r={r} className={styles.ringTrack} />
          {orden.map((o) => {
            const len = (c * (porEstado[o.key] ?? 0)) / Math.max(1, total);
            const el = (
              <circle key={o.key} cx="60" cy="60" r={r} className={`${styles.ringSeg} ${o.cls}`}
                strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-acc} transform="rotate(-90 60 60)" />
            );
            acc += len;
            return el;
          })}
          <text x="60" y="58" textAnchor="middle" className={styles.ringNum}>{total}</text>
          <text x="60" y="76" textAnchor="middle" className={styles.ringCap}>cursos</text>
        </svg>
        <ul className={styles.catalogList}>
          {orden.map((o) => (
            <li key={o.key}>
              <i className={`${styles.swatch} ${o.cls}`} aria-hidden="true" />
              <span>{o.label}</span>
              <b>{porEstado[o.key]}</b>
            </li>
          ))}
        </ul>
      </div>
      {revision > 0 && (
        <Link href="/admin/solicitudes" className={styles.callout}>
          <span><b>{revision}</b> {revision === 1 ? 'curso espera' : 'cursos esperan'} tu revisión</span>
          <span className={styles.calloutGo}>Revisar</span>
        </Link>
      )}
    </section>
  );
}

/* ── Barras horizontales con avance ────────────────────────────────────── */
function Ranking({ title, id, href, rows }: {
  title: string; id: string; href: string;
  rows: { key: string; name: string; meta: string; avance: number; href?: string }[];
}) {
  return (
    <section className={styles.panel} aria-labelledby={id}>
      <div className={styles.panelHead}>
        <h2 id={id} className={styles.panelTitle}>{title}</h2>
        <Link href={href} className={styles.link}>Ver todo</Link>
      </div>
      {rows.length === 0 ? (
        <p className={styles.empty}>Todavía no hay inscripciones.</p>
      ) : (
        <ul className={styles.rank}>
          {rows.map((r) => (
            <li key={r.key} className={styles.rankRow}>
              <div className={styles.rankTop}>
                {r.href ? <Link href={r.href} className={styles.rankName}>{r.name}</Link> : <span className={styles.rankName}>{r.name}</span>}
                <span className={styles.rankPct}>{Math.round(r.avance)}%</span>
              </div>
              <div className={styles.meter} role="img" aria-label={`Avance promedio ${Math.round(r.avance)}%`}>
                <span style={{ width: `${Math.max(2, r.avance)}%` }} />
              </div>
              <span className={styles.rankMeta}>{r.meta}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    (adminApi.stats() as Promise<Stats>).then(setStats).catch(() => setError(true));
  }, []);

  const hoy = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  return (
    <div className={styles.dashboard}>
      <PageHeader
        title="Inicio"
        subtitle={stats ? `${hoy.charAt(0).toUpperCase()}${hoy.slice(1)} · ${n(stats.alumnos)} alumnos en ${n(stats.organizaciones)} empresas` : hoy}
        actions={<Link href="/admin/cursos/crear" className="ng-btn ng-btn-primary">Crear curso</Link>}
      />

      {error && <p className={styles.empty}>No se pudieron cargar las cifras. Recarga la página.</p>}
      {!stats && !error && <div className={styles.skeleton} aria-busy="true" aria-label="Cargando cifras" />}

      {stats && (
        <>
          <Embudo e={stats.embudo} />
          <div className={styles.row}>
            <Actividad semanas={stats.semanas} />
            <Catalogo porEstado={stats.cursos_por_estado} />
          </div>
          <div className={styles.rowEven}>
            <Ranking
              title="Cursos con más alumnos" id="top-cursos" href="/admin/cursos"
              rows={stats.top_cursos.map((c) => ({
                key: c.id, name: c.titulo, href: `/admin/cursos/${c.id}/editar`, avance: c.avance_promedio,
                meta: `${n(c.inscritos)} inscritos · ${n(c.terminaron)} terminaron`,
              }))}
            />
            <Ranking
              title="Empresas" id="empresas" href="/admin/organizaciones"
              rows={stats.por_organizacion.map((o) => ({
                key: o.id, name: o.nombre, href: `/admin/organizaciones/${o.id}`, avance: o.avance_promedio,
                meta: `${n(o.alumnos)} alumnos · ${n(o.inscripciones)} inscripciones`,
              }))}
            />
          </div>
        </>
      )}
    </div>
  );
}
