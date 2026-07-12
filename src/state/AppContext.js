import React, { createContext, useContext, useMemo, useState } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null); // { name, email, authProvider, careerGoals }
  const [onboarded, setOnboarded] = useState(false);
  const [sessions, setSessions] = useState([]); // completed sessions with feedback
  const [readinessScore, setReadinessScore] = useState(42);
  const [storageDirUri, setStorageDirUri] = useState(null); // Android SAF folder for exports

  const value = useMemo(
    () => ({
      user,
      onboarded,
      sessions,
      readinessScore,
      storageDirUri,
      setStorageDirUri,
      signIn: (profile) => setUser(profile),
      signOut: () => {
        setUser(null);
        setOnboarded(false);
      },
      completeOnboarding: (goals) => {
        setUser((u) => ({ ...u, careerGoals: goals }));
        setOnboarded(true);
      },
      addSession: (session) => {
        setSessions((prev) => [session, ...prev]);
        // Readiness score nudges up with each completed session
        setReadinessScore((s) => Math.min(98, s + 5 + Math.round(Math.random() * 4)));
      },
      deleteAllData: () => {
        setSessions([]);
        setReadinessScore(42);
      },
    }),
    [user, onboarded, sessions, readinessScore, storageDirUri]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
