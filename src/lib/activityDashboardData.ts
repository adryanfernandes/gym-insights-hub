import { format, subDays, startOfYear } from "date-fns";
import type { Filters } from "@/contexts/AppContext";

export type StoredActivity = {
  query_date: string;
  branch_id: number;
  payload: Record<string, unknown>;
};

type NormalizedActivity = {
  date: Date;
  instructor: string;
  modality: string;
  area: string;
  startTime: string;
  capacity: number;
  occupied: number;
  present: number;
  absent: number;
  justifiedAbsence: number;
  hasAttendance: boolean;
};

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalize(row: StoredActivity): NormalizedActivity | null {
  const date = new Date(`${row.query_date}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const summary =
    row.payload.enrollmentSummary && typeof row.payload.enrollmentSummary === "object"
      ? (row.payload.enrollmentSummary as Record<string, unknown>)
      : null;
  const status = number(row.payload.status);
  const finalized = [6, 10, 11].includes(status);
  const enrolled = summary ? number(summary.total) : null;
  return {
    date,
    instructor: text(row.payload.instructor, "Não informado"),
    modality: text(row.payload.name, "Não informada"),
    area: text(row.payload.area, `Unidade ${row.branch_id}`),
    startTime: text(row.payload.startTime, "--:--").slice(0, 5),
    capacity: number(row.payload.capacity),
    occupied: enrolled ?? number(row.payload.ocupation ?? row.payload.occupation),
    present: finalized && summary ? number(summary.present) : 0,
    absent: finalized && summary ? number(summary.absent) : 0,
    justifiedAbsence: finalized && summary ? number(summary.justified_absence) : 0,
    hasAttendance: finalized && Boolean(summary),
  };
}

function rangeStart(period: string, now: Date) {
  const normalized = period
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized.includes("hoje"))
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (normalized.includes("7 dias")) return subDays(now, 6);
  if (normalized.includes("90 dias")) return subDays(now, 89);
  if (normalized.includes("ano")) return startOfYear(now);
  return subDays(now, 29);
}

function aggregate<T extends string>(
  rows: NormalizedActivity[],
  key: (row: NormalizedActivity) => T,
) {
  const groups = new Map<T, NormalizedActivity[]>();
  rows.forEach((row) => groups.set(key(row), [...(groups.get(key(row)) ?? []), row]));
  return groups;
}

function metrics(rows: NormalizedActivity[]) {
  const capacity = rows.reduce((total, row) => total + row.capacity, 0);
  const occupied = rows.reduce((total, row) => total + row.occupied, 0);
  const present = rows.reduce(
    (total, row) => total + (row.hasAttendance ? row.present : row.occupied),
    0,
  );
  const absent = rows.reduce((total, row) => total + row.absent, 0);
  const justifiedAbsence = rows.reduce((total, row) => total + row.justifiedAbsence, 0);
  return {
    classes: rows.length,
    capacity,
    occupied,
    occupancy: round((occupied / Math.max(capacity, 1)) * 100),
    averageStudents: round(present / Math.max(rows.length, 1)),
    present,
    absent,
    justifiedAbsence,
    noShow: round((absent / Math.max(present + absent + justifiedAbsence, 1)) * 100),
  };
}

function matchesSelection(value: string, selected: string[] | string, allOption: string) {
  const list = Array.isArray(selected) ? selected : [selected];
  return list.length === 0 || list.includes(allOption) || list.includes(value);
}

export function getActivityDashboardData(source: StoredActivity[], filters: Filters) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const start = rangeStart(filters.periodo, now);
  const periodRows = source
    .map(normalize)
    .filter((row): row is NormalizedActivity => Boolean(row))
    .filter((row) => row.date >= start && row.date <= end && row.capacity > 0);
  const options = (values: string[]) =>
    Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const filterOptions = {
    professores: ["Todos", ...options(periodRows.map((row) => row.instructor))],
    modalidades: ["Todas", ...options(periodRows.map((row) => row.modality))],
    unidades: ["Todas", ...options(periodRows.map((row) => row.area))],
    horarios: ["Todos", ...options(periodRows.map((row) => row.startTime))],
  };
  const rows = periodRows.filter(
    (row) =>
      matchesSelection(row.instructor, filters.professor, "Todos") &&
      matchesSelection(row.modality, filters.modalidade, "Todas") &&
      matchesSelection(row.area, filters.atividadeUnidade, "Todas") &&
      matchesSelection(row.startTime, filters.horario, "Todos"),
  );
  const totals = metrics(rows);

  const ranking = Array.from(aggregate(rows, (row) => row.instructor).entries())
    .map(([professor, teacherRows]) => {
      const teacherMetrics = metrics(teacherRows);
      const modalities = Array.from(aggregate(teacherRows, (row) => row.modality).entries()).sort(
        (a, b) => b[1].length - a[1].length,
      );
      const areas = Array.from(aggregate(teacherRows, (row) => row.area).entries()).sort(
        (a, b) => b[1].length - a[1].length,
      );
      return {
        professor,
        modalidade: modalities[0]?.[0] ?? "Não informada",
        unidade: areas[0]?.[0] ?? "Não informada",
        aulas: teacherMetrics.classes,
        capacidade: teacherMetrics.capacity,
        inscritos: teacherMetrics.occupied,
        presentes: teacherMetrics.present,
        faltas: teacherMetrics.absent,
        faltasJustificadas: teacherMetrics.justifiedAbsence,
        ocupacao: teacherMetrics.occupancy,
        noShow: teacherMetrics.noShow,
        mediaAlunos: teacherMetrics.averageStudents,
      };
    })
    .sort((a, b) => b.ocupacao - a.ocupacao);

  const porModalidade = Array.from(aggregate(rows, (row) => row.modality).entries())
    .map(([modalidade, modalityRows]) => {
      const value = metrics(modalityRows);
      return {
        modalidade,
        aulas: value.classes,
        ocupacao: value.occupancy,
        mediaAlunos: value.averageStudents,
      };
    })
    .sort((a, b) => b.aulas - a.aulas)
    .slice(0, 10);

  const porHorario = Array.from(aggregate(rows, (row) => row.startTime).entries())
    .map(([horario, hourRows]) => {
      const value = metrics(hourRows);
      return {
        horario,
        ocupacao: value.occupancy,
        aulas: value.classes,
        mediaAlunos: value.averageStudents,
      };
    })
    .sort((a, b) => a.horario.localeCompare(b.horario));

  const evolucao = Array.from(aggregate(rows, (row) => format(row.date, "yyyy-MM-dd")).entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([day, dayRows]) => {
      const value = metrics(dayRows);
      return {
        semana: format(new Date(`${day}T12:00:00`), "dd/MM"),
        ocupacao: value.occupancy,
        aulas: value.classes,
      };
    });

  return {
    filterOptions,
    overviewOccupancy: totals.occupancy,
    ocupacaoAgenda: porHorario.map(({ horario, ocupacao }) => ({ horario, ocupacao })),
    professores: {
      kpis: {
        totalProfessores: ranking.length,
        aulasMinistradas: totals.classes,
        capacidadeTotal: totals.capacity,
        alunosInscritos: totals.occupied,
        alunosPresentes: totals.present,
        faltas: totals.absent,
        faltasJustificadas: totals.justifiedAbsence,
        ocupacaoMedia: totals.occupancy,
        taxaNoShowMedia: totals.noShow,
        professoresAltaOcupacao: ranking.filter((row) => row.ocupacao >= 80).length,
        mediaAlunos: totals.averageStudents,
      },
      ranking,
      porModalidade,
      porHorario,
      evolucao,
      oportunidades: ranking
        .filter((row) => row.ocupacao < 55)
        .slice(-4)
        .map((row) => ({
          professor: row.professor,
          foco: "Rever grade/oferta",
          indicador: `${row.ocupacao}% de ocupação`,
        })),
    },
  };
}
