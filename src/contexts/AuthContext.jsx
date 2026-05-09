import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, supabaseMisconfigured } from '../lib/supabase'

const AuthContext = createContext(null)

// Set VITE_DEV_AUTOLOGIN=true in .env to bypass auth during local UI development.
// import.meta.env.DEV is false in production builds (vite build), so this
// can never activate in a deployed environment even if the env var is set.
const DEV_AUTOLOGIN =
  import.meta.env.VITE_DEV_AUTOLOGIN === 'true' &&
  import.meta.env.DEV

export function AuthProvider({ children }) {
  const [user, setUser] = useState(DEV_AUTOLOGIN ? { id: 'dev-user', email: 'dev@local' } : null)
  const [loading, setLoading] = useState(!DEV_AUTOLOGIN)

  useEffect(() => {
    if (DEV_AUTOLOGIN) return
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null)
      })
      .catch(() => {
        setUser(null)
      })
      .finally(() => {
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
