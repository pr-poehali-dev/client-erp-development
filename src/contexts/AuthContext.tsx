import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "@/lib/api";

interface StaffUser {
  name: string;
  role: string;
  login: string;
}

interface AuthContextType {
  user: StaffUser | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  isAdmin: false,
  isManager: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("staff_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api.staffAuth
      .check(token)
      .then((res) => {
        if (res.success && res.user) {
          setUser(res.user);
        } else {
          localStorage.removeItem("staff_token");
          localStorage.removeItem("staff_user");
        }
      })
      .catch(() => {
        localStorage.removeItem("staff_token");
        localStorage.removeItem("staff_user");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (loginVal: string, password: string) => {
    const res = await api.staffAuth.login(loginVal, password);
    if (res.token && res.user) {
      localStorage.setItem("staff_token", res.token);
      localStorage.setItem("staff_user", JSON.stringify(res.user));
      setUser(res.user);
    }
  };

  const logout = async () => {
    const token = localStorage.getItem("staff_token");
    if (token) {
      try { await api.staffAuth.logout(token); } catch { /* skip */ }
    }
    localStorage.removeItem("staff_token");
    localStorage.removeItem("staff_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAdmin: user?.role === "admin",
        isManager: user?.role === "manager",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
