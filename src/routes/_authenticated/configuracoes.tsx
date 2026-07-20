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
  return (
    <DashboardLayout
      title="Configurações"
      subtitle="Parâmetros operacionais e monitoramento"
      showFilters={false}
    >
      <Tabs defaultValue="clients-api" className="space-y-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="clients-api" className="gap-2">
            <DatabaseZap className="h-4 w-4" />
            API de clientes
          </TabsTrigger>
          <TabsTrigger value="status-api" className="gap-2">
            <ServerCog className="h-4 w-4" />
            Status do sistema
          </TabsTrigger>
          <TabsTrigger value="activities-api" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            API de atividades
          </TabsTrigger>
          <TabsTrigger value="memberships-api" className="gap-2">
            <CreditCard className="h-4 w-4" />
            API de contratos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="clients-api" className="space-y-4">
          <ClientsApiPanel />
        </TabsContent>
        <TabsContent value="status-api" className="space-y-4">
          <ApiMonitorPanel />
        </TabsContent>
        <TabsContent value="activities-api" className="space-y-4">
          <ActivitiesApiPanel />
        </TabsContent>
        <TabsContent value="memberships-api" className="space-y-4">
          <MembershipsApiPanel />
        </TabsContent>
      </Tabs>
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

function ClientsApiPanel() {
  const [isSyncingMembers, setIsSyncingMembers] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [intervalHours, setIntervalHours] = useState(24);
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
      const response = await fetch("/api/sync-members", { method: "POST" });
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
    <div className="space-y-4">
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
    </div>
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
  const [intervalMinutes, setIntervalMinutes] = useState(5);
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

  const nextScheduledAt = useMemo(() => {
    if (!enabled) return null;
    const latestLogAt = history[0] ? new Date(history[0].finished_at).getTime() : 0;
    const anchor = Math.max(latestLogAt, lastAttemptAt ?? 0, scheduleUpdatedAt ?? now);
    return new Date(anchor + intervalMinutes * 60000);
  }, [enabled, history, intervalMinutes, lastAttemptAt, now, scheduleUpdatedAt]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadSettings = useCallback(async () => {
    const response = await fetch("/api/activity-sync-settings", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    setEnabled(result.settings?.enabled !== false);
    setIntervalMinutes(result.settings?.interval_minutes ?? 5);
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
        body: JSON.stringify({ enabled: nextEnabled, intervalMinutes }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      setEnabled(result.settings.enabled);
      setIntervalMinutes(result.settings.interval_minutes);
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
              <Label htmlFor="activity-sync-minutes">Intervalo entre dias (minutos)</Label>
              <Input
                id="activity-sync-minutes"
                type="number"
                min={1}
                max={1440}
                value={intervalMinutes}
                onChange={(event) =>
                  setIntervalMinutes(Math.max(1, Math.min(1440, Number(event.target.value) || 1)))
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
  cycle_completed: boolean;
  duration_ms: number;
};

function MembershipsApiPanel() {
  const [enabled, setEnabled] = useState(true);
  const [intervalHours, setIntervalHours] = useState(24);
  const [scheduleUpdatedAt, setScheduleUpdatedAt] = useState<number | null>(null);
  const [nextSkip, setNextSkip] = useState(0);
  const [history, setHistory] = useState<MembershipSyncLog[]>([]);
  const [credential, setCredential] = useState("");
  const [hasCredential, setHasCredential] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const nextScheduledAt = useMemo(() => {
    if (!enabled) return null;
    const success = history.find((row) => row.status === "success");
    const lastSuccess = success ? new Date(success.finished_at).getTime() : 0;
    return new Date(Math.max(lastSuccess, scheduleUpdatedAt ?? now) + intervalHours * 3600000);
  }, [enabled, history, intervalHours, now, scheduleUpdatedAt]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    const response = await fetch("/api/membership-sync-settings", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    setEnabled(result.settings?.enabled !== false);
    setIntervalHours(result.settings?.interval_hours ?? 24);
    setScheduleUpdatedAt(
      new Date(
        result.settings?.schedule_updated_at || result.settings?.updated_at || Date.now(),
      ).getTime(),
    );
    setNextSkip(result.settings?.next_skip ?? 0);
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
      const settings = await patchSettings({ enabled: nextEnabled, intervalHours });
      setEnabled(settings.enabled);
      setIntervalHours(settings.interval_hours);
      setScheduleUpdatedAt(new Date(settings.schedule_updated_at).getTime());
      setMessage(
        settings.enabled
          ? `Atualização a cada ${settings.interval_hours} hora(s).`
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
              Cursor: {nextSkip}
            </Badge>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-52 space-y-2">
              <Label htmlFor="membership-sync-hours">Atualização em horas</Label>
              <Input
                id="membership-sync-hours"
                type="number"
                min={1}
                max={720}
                value={intervalHours}
                onChange={(event) => setIntervalHours(Math.max(1, Number(event.target.value) || 1))}
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
                  <TableCell>
                    {row.cycle_completed ? "Concluído" : `Cursor ${row.next_skip}`}
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
