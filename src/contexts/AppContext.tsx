import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Filters = {
  periodo: string;
  unidade: string;
  tipoContrato: string;
  sexo: string;
  faixaEtaria: string;
};

export type AppRole = "admin" | "gestor";

export type AppUser = {
  id: string;
  login: string;
  email: string;
  displayName: string;
  role: AppRole;
  password: string;
};

type Ctx = {
  theme: "light" | "dark";
  toggleTheme: () => void;
  filters: Filters;
  setFilters: (f: Partial<Filters>) => void;
  user: AppUser | null;
  users: AppUser[];
  role: AppRole | null;
  isAdmin: boolean;
  loadingAuth: boolean;
  signIn: (login: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  addUser: (input: {
    login: string;
    password: string;
    displayName: string;
    email: string;
    role: AppRole;
  }) => Promise<{ ok: boolean; error?: string }>;
  updateUserRole: (userId: string, role: AppRole) => Promise<void>;
};

const AUTH_STORAGE_KEY = "be_move_auth_user";
const USERS_STORAGE_KEY = "be_move_users";
const ADMIN_USER: AppUser = {
  id: "local-admin",
  login: "admin",
  email: "admin@be.move",
  displayName: "Administrador",
  role: "admin",
  password: "12345",
};

const AppCtx = createContext<Ctx | null>(null);

function loadUsers() {
  try {
    const saved = window.localStorage.getItem(USERS_STORAGE_KEY);
    const parsed = saved ? (JSON.parse(saved) as AppUser[]) : [];
    const withoutDuplicateAdmin = parsed.filter((user) => user.id !== ADMIN_USER.id);
    return [ADMIN_USER, ...withoutDuplicateAdmin];
  } catch {
    return [ADMIN_USER];
  }
}

function persistUsers(users: AppUser[]) {
  window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [filters, setFiltersState] = useState<Filters>({
    periodo: "Últimos 30 dias",
    unidade: "Todas",
    tipoContrato: "Todos",
    sexo: "Todos",
    faixaEtaria: "Todas",
  });
  const [users, setUsers] = useState<AppUser[]>([ADMIN_USER]);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  useEffect(() => {
    const loadedUsers = loadUsers();
    setUsers(loadedUsers);
    persistUsers(loadedUsers);

    const savedLogin = window.localStorage.getItem(AUTH_STORAGE_KEY);
    const savedUser = loadedUsers.find((item) => item.login === savedLogin) ?? null;
    setUser(savedUser);
    setLoadingAuth(false);
  }, []);

  const role: AppRole | null = user?.role ?? null;

  function setAndPersistUsers(nextUsers: AppUser[]) {
    setUsers(nextUsers);
    persistUsers(nextUsers);
    setUser((current) => {
      if (!current) return current;
      return nextUsers.find((item) => item.id === current.id) ?? null;
    });
  }

  return (
    <AppCtx.Provider
      value={{
        theme,
        toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
        filters,
        setFilters: (f) => setFiltersState((prev) => ({ ...prev, ...f })),
        user,
        users,
        role,
        isAdmin: role === "admin",
        loadingAuth,
        signIn: async (login, password) => {
          const found = users.find(
            (item) => item.login.trim().toLowerCase() === login.trim().toLowerCase(),
          );
          if (found && found.password === password) {
            window.localStorage.setItem(AUTH_STORAGE_KEY, found.login);
            setUser(found);
            return true;
          }
          return false;
        },
        signOut: async () => {
          window.localStorage.removeItem(AUTH_STORAGE_KEY);
          setUser(null);
        },
        addUser: async ({ login, password, displayName, email, role }) => {
          const normalizedLogin = login.trim();
          if (!normalizedLogin || !password.trim() || !displayName.trim()) {
            return { ok: false, error: "Preencha nome, login e senha." };
          }
          if (
            users.some(
              (item) => item.login.trim().toLowerCase() === normalizedLogin.toLowerCase(),
            )
          ) {
            return { ok: false, error: "Já existe um usuário com esse login." };
          }

          const nextUser: AppUser = {
            id: `local-${Date.now()}`,
            login: normalizedLogin,
            password,
            displayName: displayName.trim(),
            email: email.trim() || `${normalizedLogin}@be.move`,
            role,
          };
          setAndPersistUsers([...users, nextUser]);
          return { ok: true };
        },
        updateUserRole: async (userId, nextRole) => {
          setAndPersistUsers(
            users.map((item) =>
              item.id === userId ? { ...item, role: nextRole } : item,
            ),
          );
        },
      }}
    >
      {children}
    </AppCtx.Provider>
  );
}

export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
};
