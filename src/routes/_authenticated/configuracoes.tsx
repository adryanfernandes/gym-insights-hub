import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  DatabaseZap,
  KeyRound,
  Loader2,
  Play,
  RefreshCw,
  ServerCog,
  Square,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações - be.move BI" },
      { name: "description", content: "Configurações e verificações do sistema." },
    ],
  }),
  component: ConfiguracoesPage,
});

const DEFAULT_STATUS_URL = "https://status.abcevo.app/v3/summary.json";
const DEFAULT_INTERVAL_SECONDS = 5;
const MAX_LOGS = 20;
const STORAGE_KEY = "be-move-api-monitor-settings";
const LOGS_STORAGE_KEY = "be-move-api-monitor-logs";

type ApiStatus = "ok" | "warning" | "error";

type ApiCheckLog = {
  id: string;
  checkedAt: string;
  status: ApiStatus;
  message: string;
  incidents: number;
  maintenances: number;
  durationMs: number;
};

type StoredSettings = {
  url?: string;
  intervalSeconds?: number;
};

function ConfiguracoesPage() {
  const configSections = [
    {
      value: "clients-api",
      title: "API de clientes",
      description: "Cadastro de alunos e sincronização incremental",
      icon: DatabaseZap,
      component: <ClientsApiPanel />,
    },
    {
      value: "status-api",
      title: "Status do sistema",
      description: "Monitoramento da API de status",
      icon: ServerCog,
      component: <ApiMonitorPanel />,
    },
    {
      value: "activities-api",
      title: "API de atividades",
      description: "Agenda, aulas e participantes",
      icon: CalendarDays,
      component: <ActivitiesApiPanel />,
    },
    {
      value: "memberships-api",
      title: "API de contratos",
      description: "Contratos, renovações e buscas por cliente",
      icon: CreditCard,
      component: <MembershipsApiPanel />,
    },
    {
      value: "sales-api",
      title: "API vendas",
      description: "Vendas realizadas por cliente",
      icon: DatabaseZap,
      component: <SalesApiPanel />,
    },
  ];
  const [activeSection, setActiveSection] = useState(configSections[0].value);
  const currentSection =
    configSections.find((section) => section.value === activeSection) ?? configSections[0];

  return (
    <DashboardLayout
      title="Configurações"
      subtitle="Parâmetros operacionais e monitoramento"
      showFilters={false}
    >
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <nav className="space-y-2 rounded-xl border border-border bg-card p-3">
          {configSections.map((section) => {
            const Icon = section.icon;
            const isActive = section.value === currentSection.value;

            return (
              <button
                key={section.value}
                type="button"
                onClick={() => setActiveSection(section.value)}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent hover:border-border hover:bg-muted/60"
                }`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-background">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{section.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {section.description}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
        <div className="min-w-0 space-y-4">{currentSection.component}</div>
      </div>
    </DashboardLayout>
  );
}

type MemberSyncLog = {
  id: string;
  finished_at: string;
  trigger_type: "manual" | "scheduled";
  status: "success" | "error";
  total_fetched: number;
  new_members: number;
  duration_ms: number;
  error_message?: string | null;
};

type MemberSyncMode = "full" | "recent";

function ClientsApiPanel() {
  const [isSyncingMembers, setIsSyncingMembers] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [intervalHours, setIntervalHours] = useState(24);
  const [syncMode, setSyncMode] = useState<MemberSyncMode>("full");
  const [recentDays, setRecentDays] = useState(7);
  const [scheduleUpdatedAt, setScheduleUpdatedAt] = useState<number | null>(null);
  const [apiCredential, setApiCredential] = useState("");
  const [hasApiCredential, setHasApiCredential] = useState(false);
  const [isSavingCredential, setIsSavingCredential] = useState(false);
  const [history, setHistory] = useState<MemberSyncLog[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [syncMessage, setSyncMessage] = useState("");
  const [syncError, setSyncError] = useState("");

  const nextScheduledAt = useMemo(() => {
    if (!scheduleEnabled) return null;
    const lastSuccess = history.find((log) => log.status === "success");
    const lastSuccessAt = lastSuccess ? new Date(lastSuccess.finished_at).getTime() : 0;
    const anchor = Math.max(lastSuccessAt, scheduleUpdatedAt ?? now);
    return new Date(anchor + intervalHours * 60 * 60 * 1000);
  }, [history, intervalHours, now, scheduleEnabled, scheduleUpdatedAt]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadSettings = useCallback(async () => {
    const response = await fetch("/api/member-sync-settings", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    setScheduleEnabled(result.settings?.enabled !== false);
    setIntervalHours(result.settings?.interval_hours ?? 24);
    setSyncMode(result.settings?.sync_mode === "recent" ? "recent" : "full");
    setRecentDays(Math.max(1, Math.min(30, Number(result.settings?.recent_days ?? 7) || 7)));
    setScheduleUpdatedAt(
      result.settings?.schedule_updated_at
        ? new Date(result.settings.schedule_updated_at).getTime()
        : result.settings?.updated_at
          ? new Date(result.settings.updated_at).getTime()
          : Date.now(),
    );
    setHasApiCredential(result.settings?.has_api_credential === true);
    setHistory(Array.isArray(result.history) ? result.history : []);
  }, []);

  useEffect(() => {
    loadSettings().catch((error) =>
      setSyncError(error instanceof Error ? error.message : "Falha ao carregar agendamento."),
    );
    const timer = window.setInterval(() => {
      loadSettings().catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadSettings]);

  async function synchronizeMembers() {
    setIsSyncingMembers(true);
    setSyncMessage("");
    setSyncError("");
    try {
      const response = await fetch(`/api/sync-members?mode=${syncMode}`, { method: "POST" });
      const result = (await response.json()) as {
        synchronized?: number;
        newMembers?: number;
        durationMs?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      setSyncMessage(
        `${result.synchronized ?? 0} alunos sincronizados; ${result.newMembers ?? 0} novos adicionados.`,
      );
      await loadSettings();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Falha ao sincronizar alunos.");
    } finally {
      setIsSyncingMembers(false);
    }
  }

  async function saveSchedule(enabled = scheduleEnabled) {
    setIsSavingSchedule(true);
    setSyncError("");
    try {
      const response = await fetch("/api/member-sync-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled, intervalHours }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      setScheduleEnabled(result.settings.enabled);
      setIntervalHours(result.settings.interval_hours);
      setSyncMode(result.settings.sync_mode === "recent" ? "recent" : "full");
      setRecentDays(Math.max(1, Math.min(30, Number(result.settings.recent_days ?? 7) || 7)));
      setScheduleUpdatedAt(new Date(result.settings.schedule_updated_at).getTime());
      setSyncMessage(
        result.settings.enabled
          ? `Atualização agendada a cada ${result.settings.interval_hours} hora(s).`
          : "Atualização agendada pausada.",
      );
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Falha ao salvar agendamento.");
    } finally {
      setIsSavingSchedule(false);
    }
  }

  async function saveSyncMode(mode = syncMode) {
    setIsSavingSchedule(true);
    setSyncError("");
    try {
      const response = await fetch("/api/member-sync-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ syncMode: mode, recentDays }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      setSyncMode(result.settings.sync_mode === "recent" ? "recent" : "full");
      setRecentDays(Math.max(1, Math.min(30, Number(result.settings.recent_days ?? 7) || 7)));
      setScheduleUpdatedAt(new Date(result.settings.schedule_updated_at).getTime());
      setSyncMessage(
        result.settings.sync_mode === "recent"
          ? `Consulta incremental ativada: cadastros dos últimos ${result.settings.recent_days} dia(s).`
          : "Consulta completa ativada.",
      );
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Falha ao salvar tipo de consulta.");
    } finally {
      setIsSavingSchedule(false);
    }
  }

  async function saveApiCredential() {
    if (!apiCredential.trim()) {
      setSyncError("Informe a chave de acesso da API EVO.");
      return;
    }
    setIsSavingCredential(true);
    setSyncError("");
    setSyncMessage("");
    try {
      const response = await fetch("/api/member-sync-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiCredential }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      setHasApiCredential(result.settings?.has_api_credential === true);
      setApiCredential("");
      setSyncMessage("Chave da API EVO salva com sucesso.");
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Falha ao salvar chave da API.");
    } finally {
      setIsSavingCredential(false);
    }
  }

  return (
    <>
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <DatabaseZap className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">API de clientes</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Busca todos os alunos da EVO/W12 e atualiza a tabela members no Supabase.
          </p>
          {syncMessage && <p className="mt-2 text-xs text-success">{syncMessage}</p>}
          {syncError && <p className="mt-2 text-xs text-destructive">{syncError}</p>}

          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold">Chave de acesso da API EVO</p>
                <p className="text-xs text-muted-foreground">
                  {hasApiCredential
                    ? "Chave configurada. Informe outra apenas para substituí-la."
                    : "Nenhuma chave configurada."}
                </p>
              </div>
              <Badge variant={hasApiCredential ? "outline" : "destructive"} className="ml-auto">
                {hasApiCredential ? "Configurada" : "Pendente"}
              </Badge>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="password"
                autoComplete="off"
                value={apiCredential}
                onChange={(event) => setApiCredential(event.target.value)}
                placeholder="Basic ... ou apenas o token Base64"
                aria-label="Chave de acesso da API EVO"
              />
              <Button
                type="button"
                variant="outline"
                onClick={saveApiCredential}
                disabled={isSavingCredential || !apiCredential.trim()}
              >
                {isSavingCredential ? <Loader2 className="animate-spin" /> : <KeyRound />}
                Salvar chave
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Próxima atualização agendada
              </p>
              {nextScheduledAt ? (
                <>
                  <p className="mt-0.5 text-sm font-semibold">
                    {nextScheduledAt.toLocaleString("pt-BR")}
                  </p>
                  <p className="mt-0.5 font-mono text-lg font-bold text-primary">
                    {formatCountdown(nextScheduledAt.getTime() - now)}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm font-semibold text-muted-foreground">
                  Agendamento pausado
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-52 space-y-2">
              <Label htmlFor="client-sync-hours">Atualização em horas</Label>
              <Input
                id="client-sync-hours"
                type="number"
                min={1}
                max={720}
                value={intervalHours}
                onChange={(event) => setIntervalHours(Math.max(1, Number(event.target.value) || 1))}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => saveSchedule()}
              disabled={isSavingSchedule}
            >
              Salvar intervalo
            </Button>
            <Button
              type="button"
              variant={scheduleEnabled ? "outline" : "default"}
              onClick={() => saveSchedule(!scheduleEnabled)}
              disabled={isSavingSchedule}
            >
              {scheduleEnabled ? <Square /> : <Play />}
              {scheduleEnabled ? "Pausar" : "Iniciar"}
            </Button>
            <Button type="button" onClick={synchronizeMembers} disabled={isSyncingMembers}>
              {isSyncingMembers ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {isSyncingMembers ? "Sincronizando..." : "Atualizar agora"}
            </Button>
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="mb-3">
              <p className="text-sm font-semibold">Forma de consulta dos clientes</p>
              <p className="text-xs text-muted-foreground">
                A consulta incremental busca apenas alunos cadastrados nos últimos dias. A consulta
                completa continua disponível para reconstruções ou conferências gerais.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setSyncMode("recent")}
                className={`rounded-lg border p-4 text-left transition ${
                  syncMode === "recent"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <span className="text-sm font-semibold">Incremental</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Cadastro realizado de uma semana até hoje.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSyncMode("full")}
                className={`rounded-lg border p-4 text-left transition ${
                  syncMode === "full"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <span className="text-sm font-semibold">Completa</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Percorre toda a paginação de alunos da API.
                </span>
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="w-52 space-y-2">
                <Label htmlFor="client-sync-recent-days">Janela incremental em dias</Label>
                <Input
                  id="client-sync-recent-days"
                  type="number"
                  min={1}
                  max={30}
                  value={recentDays}
                  onChange={(event) =>
                    setRecentDays(Math.max(1, Math.min(30, Number(event.target.value) || 7)))
                  }
                  disabled={syncMode !== "recent"}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => saveSyncMode()}
                disabled={isSavingSchedule}
              >
                Salvar forma de consulta
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">Histórico de atualização de clientes</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Horário</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Consultados</TableHead>
              <TableHead className="text-right">Novos</TableHead>
              <TableHead className="text-right">Tempo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length ? (
              history.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{new Date(log.finished_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>{log.trigger_type === "scheduled" ? "Agendada" : "Manual"}</TableCell>
                  <TableCell>
                    <Badge variant={log.status === "success" ? "outline" : "destructive"}>
                      {log.status === "success" ? "Sucesso" : "Erro"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{log.total_fetched}</TableCell>
                  <TableCell className="text-right font-semibold">{log.new_members}</TableCell>
                  <TableCell className="text-right">
                    {Math.round(log.duration_ms / 1000)}s
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Nenhuma atualização registrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </>
  );
}

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const time = [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  return days ? `${days}d ${time}` : time;
}

function formatIntervalMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(1, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  const parts = [];

  if (hours) parts.push(`${hours} hora${hours === 1 ? "" : "s"}`);
  if (minutes) parts.push(`${minutes} minuto${minutes === 1 ? "" : "s"}`);

  return parts.join(" e ") || "1 minuto";
}

type ActivitySyncLog = {
  id: string;
  finished_at: string;
  trigger_type: "manual" | "scheduled";
  status: "success" | "error";
  month_start?: string | null;
  month_end?: string | null;
  days_queried: number;
  total_fetched: number;
  new_activities: number;
  duration_ms: number;
  error_message?: string | null;
  query_date?: string | null;
  cycle_completed?: boolean;
};

function ActivitiesApiPanel() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [intervalHours, setIntervalHours] = useState(0);
  const [intervalMinutesPart, setIntervalMinutesPart] = useState(5);
  const [scheduleUpdatedAt, setScheduleUpdatedAt] = useState<number | null>(null);
  const [lastAttemptAt, setLastAttemptAt] = useState<number | null>(null);
  const [nextQueryDate, setNextQueryDate] = useState<string | null>(null);
  const [apiCredential, setApiCredential] = useState("");
  const [hasCredential, setHasCredential] = useState(false);
  const [isSavingCredential, setIsSavingCredential] = useState(false);
  const [history, setHistory] = useState<ActivitySyncLog[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const totalIntervalMinutes = Math.max(1, intervalHours * 60 + intervalMinutesPart);

  const nextScheduledAt = useMemo(() => {
    if (!enabled) return null;
    const latestLogAt = history[0] ? new Date(history[0].finished_at).getTime() : 0;
    const anchor = Math.max(latestLogAt, lastAttemptAt ?? 0, scheduleUpdatedAt ?? now);
    return new Date(anchor + totalIntervalMinutes * 60000);
  }, [enabled, history, lastAttemptAt, now, scheduleUpdatedAt, totalIntervalMinutes]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadSettings = useCallback(async () => {
    const response = await fetch("/api/activity-sync-settings", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    const savedIntervalMinutes = Math.max(1, Number(result.settings?.interval_minutes ?? 5));
    setEnabled(result.settings?.enabled !== false);
    setIntervalHours(Math.floor(savedIntervalMinutes / 60));
    setIntervalMinutesPart(savedIntervalMinutes % 60);
    setNextQueryDate(result.settings?.next_query_date ?? null);
    setLastAttemptAt(
      result.settings?.last_attempt_at ? new Date(result.settings.last_attempt_at).getTime() : null,
    );
    setScheduleUpdatedAt(
      result.settings?.schedule_updated_at
        ? new Date(result.settings.schedule_updated_at).getTime()
        : result.settings?.updated_at
          ? new Date(result.settings.updated_at).getTime()
          : Date.now(),
    );
    setHasCredential(result.settings?.has_api_credential === true);
    setHistory(Array.isArray(result.history) ? result.history : []);
  }, []);

  useEffect(() => {
    loadSettings().catch((cause) =>
      setError(cause instanceof Error ? cause.message : "Falha ao carregar o agendamento."),
    );
    const timer = window.setInterval(() => loadSettings().catch(() => undefined), 30000);
    return () => window.clearInterval(timer);
  }, [loadSettings]);

  async function synchronize() {
    setIsSyncing(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/sync-activities", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      setMessage(
        `${result.synchronized ?? 0} atividades de ${result.queryDate ?? "um dia"} sincronizadas; ${result.newActivities ?? 0} novas. Próximo dia: ${result.nextQueryDate ?? "-"}.`,
      );
      await loadSettings();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao sincronizar atividades.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function saveSchedule(nextEnabled = enabled) {
    setIsSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/activity-sync-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled, intervalMinutes: totalIntervalMinutes }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      const savedIntervalMinutes = Math.max(1, Number(result.settings.interval_minutes ?? 5));
      setEnabled(result.settings.enabled);
      setIntervalHours(Math.floor(savedIntervalMinutes / 60));
      setIntervalMinutesPart(savedIntervalMinutes % 60);
      setScheduleUpdatedAt(new Date(result.settings.schedule_updated_at).getTime());
      setMessage(
        result.settings.enabled
          ? `Atualização agendada a cada ${result.settings.interval_minutes} minuto(s).`
          : "Atualização agendada pausada.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar o agendamento.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveCredential() {
    if (!apiCredential.trim()) return;
    setIsSavingCredential(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/activity-sync-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiCredential }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      setHasCredential(result.settings?.has_api_credential === true);
      setApiCredential("");
      setMessage("Chave da API EVO salva com sucesso.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar a chave da API.");
    } finally {
      setIsSavingCredential(false);
    }
  }

  return (
    <Tabs defaultValue="sync" className="space-y-4">
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="sync">Sincronizacao</TabsTrigger>
        <TabsTrigger value="missing">Alunos sem contrato</TabsTrigger>
        <TabsTrigger value="manual-list">Lista manual</TabsTrigger>
      </TabsList>
      <TabsContent value="sync" className="space-y-4">
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">API de atividades</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Consulta um dia do mês por execução. A fila avança até completar todos os dias e então
              reinicia o ciclo do mês corrente.
            </p>
            {message && <p className="mt-2 text-xs text-success">{message}</p>}
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold">Chave de acesso da API EVO</p>
                <p className="text-xs text-muted-foreground">
                  {hasCredential
                    ? "Chave configurada. A chave da API de clientes também pode ser reutilizada."
                    : "Nenhuma chave configurada."}
                </p>
              </div>
              <Badge variant={hasCredential ? "outline" : "destructive"} className="ml-auto">
                {hasCredential ? "Configurada" : "Pendente"}
              </Badge>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="password"
                autoComplete="off"
                value={apiCredential}
                onChange={(event) => setApiCredential(event.target.value)}
                placeholder="Basic ... ou apenas o token Base64"
                aria-label="Chave de acesso da API de atividades"
              />
              <Button
                type="button"
                variant="outline"
                onClick={saveCredential}
                disabled={isSavingCredential || !apiCredential.trim()}
              >
                {isSavingCredential ? <Loader2 className="animate-spin" /> : <KeyRound />}
                Salvar chave
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Próxima atualização agendada
              </p>
              {nextScheduledAt ? (
                <>
                  <p className="mt-0.5 text-sm font-semibold">
                    {nextScheduledAt.toLocaleString("pt-BR")}
                  </p>
                  <p className="mt-0.5 font-mono text-lg font-bold text-primary">
                    {formatCountdown(nextScheduledAt.getTime() - now)}
                  </p>
                  {nextQueryDate && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Próximo dia da fila:{" "}
                      {new Date(`${nextQueryDate}T12:00:00`).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-sm font-semibold text-muted-foreground">
                  Agendamento pausado
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-52 space-y-2">
              <Label htmlFor="activity-sync-hours">Horas</Label>
              <Input
                id="activity-sync-hours"
                type="number"
                min={0}
                max={24}
                value={intervalHours}
                onChange={(event) =>
                  setIntervalHours(Math.max(0, Math.min(24, Number(event.target.value) || 0)))
                }
              />
            </div>
            <div className="w-32 space-y-2">
              <Label htmlFor="activity-sync-minutes">Minutos</Label>
              <Input
                id="activity-sync-minutes"
                type="number"
                min={0}
                max={59}
                value={intervalMinutesPart}
                onChange={(event) =>
                  setIntervalMinutesPart(
                    Math.max(0, Math.min(59, Number(event.target.value) || 0)),
                  )
                }
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => saveSchedule()}
              disabled={isSaving}
            >
              Salvar intervalo
            </Button>
            <Button
              type="button"
              variant={enabled ? "outline" : "default"}
              onClick={() => saveSchedule(!enabled)}
              disabled={isSaving}
            >
              {enabled ? <Square /> : <Play />}
              {enabled ? "Pausar" : "Iniciar"}
            </Button>
            <Button type="button" onClick={synchronize} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {isSyncing ? "Sincronizando um dia..." : "Atualizar próximo dia"}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">Histórico de atualização de atividades</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Horário</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dia consultado</TableHead>
              <TableHead className="text-right">Consultadas</TableHead>
              <TableHead className="text-right">Novas</TableHead>
              <TableHead className="text-right">Tempo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length ? (
              history.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{new Date(log.finished_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>{log.trigger_type === "scheduled" ? "Agendada" : "Manual"}</TableCell>
                  <TableCell>
                    <Badge variant={log.status === "success" ? "outline" : "destructive"}>
                      {log.status === "success" ? "Sucesso" : "Erro"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {log.query_date
                      ? new Date(`${log.query_date}T12:00:00`).toLocaleDateString("pt-BR")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">{log.total_fetched}</TableCell>
                  <TableCell className="text-right font-semibold">{log.new_activities}</TableCell>
                  <TableCell className="text-right">
                    {Math.round(log.duration_ms / 1000)}s
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Nenhuma atualização registrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
      </TabsContent>
      <TabsContent value="missing" className="space-y-4">
        <MissingMembershipsPanel />
      </TabsContent>
      <TabsContent value="manual-list" className="space-y-4">
        <ManualMembershipLookupPanel />
      </TabsContent>
    </Tabs>
  );
}

type MembershipSyncLog = {
  id: string;
  finished_at: string;
  trigger_type: "manual" | "scheduled";
  status: "success" | "error";
  total_fetched: number;
  new_memberships: number;
  receivables_synced: number;
  next_skip: number;
  members_checked?: number;
  cycle_completed: boolean;
  duration_ms: number;
};

function MembershipsApiPanel() {
  const [enabled, setEnabled] = useState(true);
  const [intervalHours, setIntervalHours] = useState(24);
  const [intervalMinutesPart, setIntervalMinutesPart] = useState(0);
  const [scheduleUpdatedAt, setScheduleUpdatedAt] = useState<number | null>(null);
  const [nextSkip, setNextSkip] = useState(0);
  const [nextMemberOffset, setNextMemberOffset] = useState(0);
  const [history, setHistory] = useState<MembershipSyncLog[]>([]);
  const [credential, setCredential] = useState("");
  const [hasCredential, setHasCredential] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const totalIntervalMinutes = Math.max(1, intervalHours * 60 + intervalMinutesPart);

  const nextScheduledAt = useMemo(() => {
    if (!enabled) return null;
    const success = history.find((row) => row.status === "success");
    const lastSuccess = success ? new Date(success.finished_at).getTime() : 0;
    return new Date(Math.max(lastSuccess, scheduleUpdatedAt ?? now) + totalIntervalMinutes * 60000);
  }, [enabled, history, now, scheduleUpdatedAt, totalIntervalMinutes]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    const response = await fetch("/api/membership-sync-settings", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    const savedIntervalMinutes = Math.max(
      1,
      Number(result.settings?.interval_minutes ?? (result.settings?.interval_hours ?? 24) * 60),
    );
    setEnabled(result.settings?.enabled !== false);
    setIntervalHours(Math.floor(savedIntervalMinutes / 60));
    setIntervalMinutesPart(savedIntervalMinutes % 60);
    setScheduleUpdatedAt(
      new Date(
        result.settings?.schedule_updated_at || result.settings?.updated_at || Date.now(),
      ).getTime(),
    );
    setNextSkip(result.settings?.next_skip ?? 0);
    setNextMemberOffset(result.settings?.next_member_offset ?? 0);
    setHasCredential(result.settings?.has_api_credential === true);
    setHistory(Array.isArray(result.history) ? result.history : []);
  }, []);

  useEffect(() => {
    load().catch((cause) =>
      setError(cause instanceof Error ? cause.message : "Falha ao carregar."),
    );
    const timer = window.setInterval(() => load().catch(() => undefined), 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function patchSettings(body: Record<string, unknown>) {
    const response = await fetch("/api/membership-sync-settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    return result.settings;
  }

  async function saveSchedule(nextEnabled = enabled) {
    setSaving(true);
    setError("");
    try {
      const intervalMinutes = Math.max(1, intervalHours * 60 + intervalMinutesPart);
      const settings = await patchSettings({ enabled: nextEnabled, intervalMinutes });
      const savedIntervalMinutes = Math.max(
        1,
        Number(settings.interval_minutes ?? (settings.interval_hours ?? 24) * 60),
      );
      setEnabled(settings.enabled);
      setIntervalHours(Math.floor(savedIntervalMinutes / 60));
      setIntervalMinutesPart(savedIntervalMinutes % 60);
      setScheduleUpdatedAt(new Date(settings.schedule_updated_at).getTime());
      setMessage(
        settings.enabled
          ? `Atualização a cada ${formatIntervalMinutes(savedIntervalMinutes)}.`
          : "Agendamento pausado.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCredential() {
    if (!credential.trim()) return;
    setSaving(true);
    setError("");
    try {
      const settings = await patchSettings({ apiCredential: credential });
      setHasCredential(settings.has_api_credential === true);
      setCredential("");
      setMessage("Chave salva com sucesso.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar chave.");
    } finally {
      setSaving(false);
    }
  }

  async function sync() {
    setSyncing(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/sync-memberships", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      setMessage(
        `${result.synchronized} contratos e ${result.receivablesSynced} recebíveis processados; ${result.newMemberships} contratos novos.${result.cycleCompleted ? " Ciclo concluído." : " A próxima execução continuará do cursor salvo."}`,
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao sincronizar contratos.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Tabs defaultValue="sync" className="space-y-4">
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="sync">Sincronizacao</TabsTrigger>
        <TabsTrigger value="missing">Alunos sem contrato</TabsTrigger>
        <TabsTrigger value="manual-list">Lista manual</TabsTrigger>
      </TabsList>
      <TabsContent value="sync" className="space-y-4">
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">API de contratos e recebíveis</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Sincronização incremental e segura. Documentos, TID, NSU e autorizações não são
              armazenados.
            </p>
            {message && <p className="mt-2 text-xs text-success">{message}</p>}
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Chave da API EVO</p>
              <Badge variant={hasCredential ? "outline" : "destructive"} className="ml-auto">
                {hasCredential ? "Configurada" : "Pendente"}
              </Badge>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="password"
                value={credential}
                onChange={(event) => setCredential(event.target.value)}
                placeholder="Basic ... ou token Base64"
                autoComplete="off"
              />
              <Button
                variant="outline"
                onClick={saveCredential}
                disabled={saving || !credential.trim()}
              >
                <KeyRound /> Salvar chave
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Próxima atualização</p>
              {nextScheduledAt ? (
                <>
                  <p className="text-sm font-semibold">{nextScheduledAt.toLocaleString("pt-BR")}</p>
                  <p className="font-mono text-lg font-bold text-primary">
                    {formatCountdown(nextScheduledAt.getTime() - now)}
                  </p>
                </>
              ) : (
                <p className="text-sm font-semibold text-muted-foreground">Agendamento pausado</p>
              )}
            </div>
            <Badge variant="outline" className="ml-auto">
              Cliente: {nextMemberOffset} | Cursor: {nextSkip}
            </Badge>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-52 space-y-2">
              <Label htmlFor="membership-sync-hours">Horas</Label>
              <Input
                id="membership-sync-hours"
                type="number"
                min={0}
                max={720}
                value={intervalHours}
                onChange={(event) =>
                  setIntervalHours(Math.max(0, Math.min(720, Number(event.target.value) || 0)))
                }
              />
            </div>
            <div className="w-32 space-y-2">
              <Label htmlFor="membership-sync-minutes">Minutos</Label>
              <Input
                id="membership-sync-minutes"
                type="number"
                min={0}
                max={59}
                value={intervalMinutesPart}
                onChange={(event) =>
                  setIntervalMinutesPart(
                    Math.max(0, Math.min(59, Number(event.target.value) || 0)),
                  )
                }
              />
            </div>
            <Button variant="outline" onClick={() => saveSchedule()} disabled={saving}>
              Salvar intervalo
            </Button>
            <Button
              variant={enabled ? "outline" : "default"}
              onClick={() => saveSchedule(!enabled)}
              disabled={saving}
            >
              {enabled ? <Square /> : <Play />} {enabled ? "Pausar" : "Iniciar"}
            </Button>
            <Button onClick={sync} disabled={syncing}>
              {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {syncing ? "Processando lote..." : "Atualizar agora"}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">Histórico de contratos</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Horário</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Contratos</TableHead>
              <TableHead className="text-right">Novos</TableHead>
              <TableHead className="text-right">Recebíveis</TableHead>
              <TableHead className="text-right">Clientes</TableHead>
              <TableHead>Ciclo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length ? (
              history.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{new Date(row.finished_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>{row.trigger_type === "scheduled" ? "Agendada" : "Manual"}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "success" ? "outline" : "destructive"}>
                      {row.status === "success" ? "Sucesso" : "Erro"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{row.total_fetched}</TableCell>
                  <TableCell className="text-right font-semibold">{row.new_memberships}</TableCell>
                  <TableCell className="text-right">{row.receivables_synced}</TableCell>
                  <TableCell className="text-right">{row.members_checked ?? 0}</TableCell>
                  <TableCell>
                    {row.cycle_completed ? "Concluído" : `Cursor ${row.next_skip}`}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Nenhuma atualização registrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
      </TabsContent>
      <TabsContent value="missing" className="space-y-4">
        <MissingMembershipsPanel />
      </TabsContent>
      <TabsContent value="manual-list" className="space-y-4">
        <ManualMembershipLookupPanel />
      </TabsContent>
    </Tabs>
  );
}

type SalesSyncLog = {
  id: string;
  finished_at: string;
  trigger_type: "manual" | "scheduled";
  status: "success" | "error";
  total_fetched: number;
  new_sales: number;
  next_skip: number;
  members_checked?: number;
  cycle_completed: boolean;
  duration_ms: number;
};

function SalesApiPanel() {
  const [enabled, setEnabled] = useState(true);
  const [intervalHours, setIntervalHours] = useState(24);
  const [intervalMinutesPart, setIntervalMinutesPart] = useState(0);
  const [scheduleUpdatedAt, setScheduleUpdatedAt] = useState<number | null>(null);
  const [nextSkip, setNextSkip] = useState(0);
  const [nextMemberOffset, setNextMemberOffset] = useState(0);
  const [history, setHistory] = useState<SalesSyncLog[]>([]);
  const [credential, setCredential] = useState("");
  const [hasCredential, setHasCredential] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const totalIntervalMinutes = Math.max(1, intervalHours * 60 + intervalMinutesPart);

  const nextScheduledAt = useMemo(() => {
    if (!enabled) return null;
    const success = history.find((row) => row.status === "success");
    const lastSuccess = success ? new Date(success.finished_at).getTime() : 0;
    return new Date(Math.max(lastSuccess, scheduleUpdatedAt ?? now) + totalIntervalMinutes * 60000);
  }, [enabled, history, now, scheduleUpdatedAt, totalIntervalMinutes]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    const response = await fetch("/api/sales-sync-settings", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    const savedIntervalMinutes = Math.max(
      1,
      Number(result.settings?.interval_minutes ?? (result.settings?.interval_hours ?? 24) * 60),
    );
    setEnabled(result.settings?.enabled !== false);
    setIntervalHours(Math.floor(savedIntervalMinutes / 60));
    setIntervalMinutesPart(savedIntervalMinutes % 60);
    setScheduleUpdatedAt(
      new Date(
        result.settings?.schedule_updated_at || result.settings?.updated_at || Date.now(),
      ).getTime(),
    );
    setNextSkip(result.settings?.next_skip ?? 0);
    setNextMemberOffset(result.settings?.next_member_offset ?? 0);
    setHasCredential(result.settings?.has_api_credential === true);
    setHistory(Array.isArray(result.history) ? result.history : []);
  }, []);

  useEffect(() => {
    load().catch((cause) =>
      setError(cause instanceof Error ? cause.message : "Falha ao carregar vendas."),
    );
    const timer = window.setInterval(() => load().catch(() => undefined), 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function patchSettings(body: Record<string, unknown>) {
    const response = await fetch("/api/sales-sync-settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    return result.settings;
  }

  async function saveSchedule(nextEnabled = enabled) {
    setSaving(true);
    setError("");
    try {
      const intervalMinutes = Math.max(1, intervalHours * 60 + intervalMinutesPart);
      const settings = await patchSettings({ enabled: nextEnabled, intervalMinutes });
      const savedIntervalMinutes = Math.max(
        1,
        Number(settings.interval_minutes ?? (settings.interval_hours ?? 24) * 60),
      );
      setEnabled(settings.enabled);
      setIntervalHours(Math.floor(savedIntervalMinutes / 60));
      setIntervalMinutesPart(savedIntervalMinutes % 60);
      setScheduleUpdatedAt(new Date(settings.schedule_updated_at).getTime());
      setMessage(
        settings.enabled
          ? `Atualização a cada ${formatIntervalMinutes(savedIntervalMinutes)}.`
          : "Agendamento pausado.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar vendas.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCredential() {
    if (!credential.trim()) return;
    setSaving(true);
    setError("");
    try {
      const settings = await patchSettings({ apiCredential: credential });
      setHasCredential(settings.has_api_credential === true);
      setCredential("");
      setMessage("Chave salva com sucesso.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar chave.");
    } finally {
      setSaving(false);
    }
  }

  async function sync() {
    setSyncing(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/sync-sales", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      setMessage(
        `${result.synchronized ?? 0} vendas processadas; ${result.newSales ?? 0} vendas novas.${result.cycleCompleted ? " Ciclo concluído." : " A próxima execução continuará do cursor salvo."}`,
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao sincronizar vendas.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex items-center gap-2">
              <DatabaseZap className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">API vendas</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Consulta /api/v2/sales com paginação por skip/take e guarda o retorno original na
              tabela sales do Supabase.
            </p>
            {message && <p className="mt-2 text-xs text-success">{message}</p>}
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Chave da API EVO</p>
              <Badge variant={hasCredential ? "outline" : "destructive"} className="ml-auto">
                {hasCredential ? "Configurada" : "Pendente"}
              </Badge>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="password"
                value={credential}
                onChange={(event) => setCredential(event.target.value)}
                placeholder="Basic ... ou token Base64"
                autoComplete="off"
              />
              <Button
                variant="outline"
                onClick={saveCredential}
                disabled={saving || !credential.trim()}
              >
                <KeyRound /> Salvar chave
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Próxima atualização</p>
              {nextScheduledAt ? (
                <>
                  <p className="text-sm font-semibold">{nextScheduledAt.toLocaleString("pt-BR")}</p>
                  <p className="font-mono text-lg font-bold text-primary">
                    {formatCountdown(nextScheduledAt.getTime() - now)}
                  </p>
                </>
              ) : (
                <p className="text-sm font-semibold text-muted-foreground">Agendamento pausado</p>
              )}
            </div>
            <Badge variant="outline" className="ml-auto">
              Cliente: {nextMemberOffset} | Cursor: {nextSkip}
            </Badge>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-52 space-y-2">
              <Label htmlFor="sales-sync-hours">Horas</Label>
              <Input
                id="sales-sync-hours"
                type="number"
                min={0}
                max={720}
                value={intervalHours}
                onChange={(event) =>
                  setIntervalHours(Math.max(0, Math.min(720, Number(event.target.value) || 0)))
                }
              />
            </div>
            <div className="w-32 space-y-2">
              <Label htmlFor="sales-sync-minutes">Minutos</Label>
              <Input
                id="sales-sync-minutes"
                type="number"
                min={0}
                max={59}
                value={intervalMinutesPart}
                onChange={(event) =>
                  setIntervalMinutesPart(
                    Math.max(0, Math.min(59, Number(event.target.value) || 0)),
                  )
                }
              />
            </div>
            <Button variant="outline" onClick={() => saveSchedule()} disabled={saving}>
              Salvar intervalo
            </Button>
            <Button
              variant={enabled ? "outline" : "default"}
              onClick={() => saveSchedule(!enabled)}
              disabled={saving}
            >
              {enabled ? <Square /> : <Play />} {enabled ? "Pausar" : "Iniciar"}
            </Button>
            <Button onClick={sync} disabled={syncing}>
              {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {syncing ? "Processando lote..." : "Atualizar agora"}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">Histórico de vendas</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Horário</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">Novas</TableHead>
              <TableHead className="text-right">Clientes</TableHead>
              <TableHead className="text-right">Tempo</TableHead>
              <TableHead>Ciclo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length ? (
              history.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{new Date(row.finished_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>{row.trigger_type === "scheduled" ? "Agendada" : "Manual"}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "success" ? "outline" : "destructive"}>
                      {row.status === "success" ? "Sucesso" : "Erro"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{row.total_fetched}</TableCell>
                  <TableCell className="text-right font-semibold">{row.new_sales}</TableCell>
                  <TableCell className="text-right">{row.members_checked ?? 0}</TableCell>
                  <TableCell className="text-right">
                    {Math.round(row.duration_ms / 1000)}s
                  </TableCell>
                  <TableCell>{row.cycle_completed ? "Concluído" : `Cursor ${row.next_skip}`}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Nenhuma atualização registrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

type MissingMembershipRow = {
  id: number;
  nome: string;
};

type MissingMembershipSummary = {
  count: number;
  sample: MissingMembershipRow[];
};

function MissingMembershipsPanel() {
  const [summary, setSummary] = useState<MissingMembershipSummary>({ count: 0, sample: [] });
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadMissing = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/missing-memberships", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      setSummary({
        count: Number(result.count) || 0,
        sample: Array.isArray(result.sample) ? result.sample : [],
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao verificar alunos sem contrato.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMissing().catch(() => undefined);
  }, [loadMissing]);

  async function syncMissing() {
    setSyncing(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/missing-memberships", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      setSummary({
        count: Number(result.missingAfter) || 0,
        sample: Array.isArray(result.sample) ? result.sample : [],
      });
      setMessage(
        `${result.checkedMembers ?? 0} alunos consultados por ID; ${result.synchronized ?? 0} contratos e ${result.receivablesSynced ?? 0} recebíveis processados; ${result.newMemberships ?? 0} contratos novos. Restam ${result.missingAfter ?? 0} alunos sem contrato cadastrado.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao buscar contratos ausentes.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Alunos sem contratos no Supabase</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Verifica alunos cadastrados que ainda não possuem nenhum contrato salvo e consulta a
              EVO/W12 pelo ID do aluno para tentar recuperar o histórico de contratos.
            </p>
            {message && <p className="mt-2 text-xs text-success">{message}</p>}
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Alunos sem contrato</p>
              <p className="mt-1 text-2xl font-bold">
                {loading ? "..." : summary.count.toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Lote por execução</p>
              <p className="mt-1 text-2xl font-bold">{limit}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Modo de busca</p>
              <p className="mt-1 text-sm font-semibold">idMember na API de contratos</p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-52 space-y-2">
              <Label htmlFor="missing-membership-limit">Alunos por busca</Label>
              <Input
                id="missing-membership-limit"
                type="number"
                min={1}
                max={50}
                value={limit}
                onChange={(event) =>
                  setLimit(Math.max(1, Math.min(50, Number(event.target.value) || 1)))
                }
              />
            </div>
            <Button variant="outline" onClick={loadMissing} disabled={loading || syncing}>
              {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Verificar lista
            </Button>
            <Button onClick={syncMissing} disabled={syncing || loading || summary.count === 0}>
              {syncing ? <Loader2 className="animate-spin" /> : <DatabaseZap />}
              {syncing ? "Buscando contratos..." : "Buscar contratos por ID"}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">Primeiros alunos sem contrato</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Aluno</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.sample.length ? (
              summary.sample.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.id}</TableCell>
                  <TableCell className="font-medium">{row.nome}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                  {loading ? "Carregando..." : "Nenhum aluno sem contrato encontrado."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

type ManualMembershipResult = {
  checkedMembers: number;
  requestedMembers?: number;
  synchronized: number;
  newMemberships: number;
  receivablesSynced: number;
  durationMs: number;
  checkedSample: MissingMembershipRow[];
};

function parseManualMemberIds(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,;]+/)
        .map((item) => Number(item.trim()))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  );
}

function ManualMembershipLookupPanel() {
  const [memberIdsText, setMemberIdsText] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ManualMembershipResult | null>(null);
  const parsedIds = useMemo(() => parseManualMemberIds(memberIdsText), [memberIdsText]);

  async function syncManualList() {
    if (!parsedIds.length) {
      setError("Informe ao menos um número de cliente válido.");
      return;
    }
    setSyncing(true);
    setMessage("");
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/missing-memberships", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberIds: parsedIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setResult({
        checkedMembers: Number(data.checkedMembers) || 0,
        requestedMembers: Number(data.requestedMembers) || parsedIds.length,
        synchronized: Number(data.synchronized) || 0,
        newMemberships: Number(data.newMemberships) || 0,
        receivablesSynced: Number(data.receivablesSynced) || 0,
        durationMs: Number(data.durationMs) || 0,
        checkedSample: Array.isArray(data.checkedSample) ? data.checkedSample : [],
      });
      setMessage(
        `${data.checkedMembers ?? 0} clientes consultados; ${data.synchronized ?? 0} contratos e ${data.receivablesSynced ?? 0} recebíveis processados; ${data.newMemberships ?? 0} contratos novos.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao consultar lista informada.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex items-center gap-2">
              <DatabaseZap className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Consultar contratos por lista de clientes</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Cole os números dos clientes separados por linha, vírgula, ponto e vírgula ou espaço.
              A consulta usa o parâmetro idMember da API de contratos e atualiza o Supabase.
            </p>
            {message && <p className="mt-2 text-xs text-success">{message}</p>}
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">IDs válidos na lista</p>
              <p className="mt-1 text-2xl font-bold">{parsedIds.length.toLocaleString("pt-BR")}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Limite por execução</p>
              <p className="mt-1 text-2xl font-bold">50</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Modo de busca</p>
              <p className="mt-1 text-sm font-semibold">idMember informado pelo usuário</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-membership-ids">Lista de clientes</Label>
            <textarea
              id="manual-membership-ids"
              value={memberIdsText}
              onChange={(event) => setMemberIdsText(event.target.value)}
              placeholder={"18086\n21170\n16815"}
              className="min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
            />
            <p className="text-xs text-muted-foreground">
              Se a lista tiver mais de 50 IDs, serão consultados os primeiros 50 nesta execução.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={syncManualList} disabled={syncing || parsedIds.length === 0}>
              {syncing ? <Loader2 className="animate-spin" /> : <DatabaseZap />}
              {syncing ? "Consultando contratos..." : "Consultar lista"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={syncing || !memberIdsText.trim()}
              onClick={() => {
                setMemberIdsText("");
                setResult(null);
                setMessage("");
                setError("");
              }}
            >
              Limpar
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">Resultado da última consulta manual</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Indicador</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result ? (
              <>
                <TableRow>
                  <TableCell>Clientes solicitados</TableCell>
                  <TableCell className="text-right">{result.requestedMembers ?? parsedIds.length}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Clientes consultados</TableCell>
                  <TableCell className="text-right">{result.checkedMembers}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Contratos processados</TableCell>
                  <TableCell className="text-right font-semibold">{result.synchronized}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Contratos novos</TableCell>
                  <TableCell className="text-right font-semibold">{result.newMemberships}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Recebíveis processados</TableCell>
                  <TableCell className="text-right">{result.receivablesSynced}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Duração</TableCell>
                  <TableCell className="text-right">{Math.round(result.durationMs / 1000)}s</TableCell>
                </TableRow>
              </>
            ) : (
              <TableRow>
                <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                  Nenhuma consulta manual realizada nesta sessão.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

function ApiMonitorPanel() {
  const savedSettings = useMemo(readStoredSettings, []);
  const [url, setUrl] = useState(savedSettings.url ?? DEFAULT_STATUS_URL);
  const [intervalSeconds, setIntervalSeconds] = useState(
    savedSettings.intervalSeconds ?? DEFAULT_INTERVAL_SECONDS,
  );
  const [isRunning, setIsRunning] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [logs, setLogs] = useState<ApiCheckLog[]>(() => readStoredLogs());
  const timerRef = useRef<number | null>(null);

  const lastLog = logs[0];

  useEffect(() => {
    const settings: StoredSettings = { url, intervalSeconds };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [intervalSeconds, url]);

  const runCheck = useCallback(async () => {
    const startedAt = performance.now();
    const checkedAt = new Date().toLocaleString("pt-BR");

    setIsChecking(true);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const incidents = Array.isArray(data?.activeIncidents) ? data.activeIncidents.length : 0;
      const maintenances = Array.isArray(data?.activeMaintenances)
        ? data.activeMaintenances.length
        : 0;
      const hasIssue = incidents > 0 || maintenances > 0;

      addLog({
        id: crypto.randomUUID(),
        checkedAt,
        status: hasIssue ? "warning" : "ok",
        message: hasIssue ? "Incidente ou manutenção detectada" : "Sistema OK",
        incidents,
        maintenances,
        durationMs: Math.round(performance.now() - startedAt),
      });
    } catch (error) {
      addLog({
        id: crypto.randomUUID(),
        checkedAt,
        status: "error",
        message: error instanceof Error ? error.message : "Falha ao consultar API",
        incidents: 0,
        maintenances: 0,
        durationMs: Math.round(performance.now() - startedAt),
      });
    } finally {
      setIsChecking(false);
    }
  }, [url]);

  useEffect(() => {
    if (!isRunning) return;

    runCheck();
    timerRef.current = window.setInterval(runCheck, Math.max(1, intervalSeconds) * 1000);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [intervalSeconds, isRunning, runCheck]);

  function addLog(log: ApiCheckLog) {
    setLogs((current) => {
      const nextLogs = [log, ...current].slice(0, MAX_LOGS);
      window.localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(nextLogs));
      return nextLogs;
    });
  }

  function handleIntervalChange(value: string) {
    const nextValue = Number(value);
    if (Number.isFinite(nextValue)) {
      setIntervalSeconds(Math.max(1, Math.min(3600, nextValue)));
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold">Verificação de API</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Consulta o resumo de status e sinaliza incidentes ou manutenções ativas.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
              <div className="space-y-2">
                <Label htmlFor="api-status-url">URL de status</Label>
                <Input
                  id="api-status-url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder={DEFAULT_STATUS_URL}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-interval">Atualização em segundos</Label>
                <Input
                  id="api-interval"
                  type="number"
                  min={1}
                  max={3600}
                  value={intervalSeconds}
                  onChange={(event) => handleIntervalChange(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => setIsRunning((current) => !current)}
                variant={isRunning ? "outline" : "default"}
                className="gap-2"
              >
                {isRunning ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isRunning ? "Pausar" : "Iniciar"}
              </Button>
              <Button
                type="button"
                onClick={runCheck}
                variant="outline"
                disabled={isChecking}
                className="gap-2"
              >
                {isChecking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Verificar agora
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Status atual</h2>
              <p className="mt-1 text-xs text-muted-foreground">Última verificação registrada</p>
            </div>
            {lastLog && <StatusBadge status={lastLog.status} />}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <div className={statusIconClass(lastLog?.status)}>
              {lastLog?.status === "warning" ? (
                <AlertTriangle className="h-5 w-5" />
              ) : lastLog?.status === "error" ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">
                {lastLog?.message ?? "Aguardando primeira verificação"}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {lastLog?.checkedAt ?? `A cada ${intervalSeconds}s`}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Metric label="Incidentes" value={lastLog?.incidents ?? 0} />
            <Metric label="Manutenções" value={lastLog?.maintenances ?? 0} />
            <Metric label="Tempo" value={lastLog ? `${lastLog.durationMs}ms` : "-"} />
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Log das últimas 20 verificações</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Registros mais recentes aparecem primeiro.
            </p>
          </div>
          <Badge variant="outline">
            {logs.length}/{MAX_LOGS}
          </Badge>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Horário</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead className="text-right">Incidentes</TableHead>
              <TableHead className="text-right">Manutenções</TableHead>
              <TableHead className="text-right">Tempo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Nenhuma verificação registrada ainda.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">{log.checkedAt}</TableCell>
                  <TableCell>
                    <StatusBadge status={log.status} />
                  </TableCell>
                  <TableCell className="min-w-[220px]">{log.message}</TableCell>
                  <TableCell className="text-right">{log.incidents}</TableCell>
                  <TableCell className="text-right">{log.maintenances}</TableCell>
                  <TableCell className="text-right">{log.durationMs}ms</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: ApiStatus }) {
  if (status === "ok") {
    return <Badge className="bg-success text-success-foreground hover:bg-success">OK</Badge>;
  }

  if (status === "warning") {
    return <Badge className="bg-warning text-warning-foreground hover:bg-warning">Atenção</Badge>;
  }

  return <Badge variant="destructive">Erro</Badge>;
}

function statusIconClass(status?: ApiStatus) {
  const base = "grid h-11 w-11 shrink-0 place-items-center rounded-lg";

  if (status === "warning") return `${base} bg-warning/15 text-warning`;
  if (status === "error") return `${base} bg-destructive/10 text-destructive`;
  return `${base} bg-success/10 text-success`;
}

function readStoredSettings(): StoredSettings {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredSettings;

    return {
      url: typeof parsed.url === "string" && parsed.url ? parsed.url : undefined,
      intervalSeconds:
        typeof parsed.intervalSeconds === "number" ? parsed.intervalSeconds : undefined,
    };
  } catch {
    return {};
  }
}

function readStoredLogs(): ApiCheckLog[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(LOGS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isApiCheckLog).slice(0, MAX_LOGS);
  } catch {
    return [];
  }
}

function isApiCheckLog(value: unknown): value is ApiCheckLog {
  if (!value || typeof value !== "object") return false;

  const log = value as Partial<ApiCheckLog>;

  return (
    typeof log.id === "string" &&
    typeof log.checkedAt === "string" &&
    (log.status === "ok" || log.status === "warning" || log.status === "error") &&
    typeof log.message === "string" &&
    typeof log.incidents === "number" &&
    typeof log.maintenances === "number" &&
    typeof log.durationMs === "number"
  );
}
