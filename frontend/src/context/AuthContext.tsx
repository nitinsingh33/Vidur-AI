import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchSession,
  login as loginRequest,
  signup as signupRequest,
  type AuthMerchant,
  type AuthUser,
  type LoginPayload,
  type SignupPayload,
} from '../api/auth'

const TOKEN_STORAGE_KEY = 'vidur_token'

interface AuthContextValue {
  token: string | null
  user: AuthUser | null
  merchant: AuthMerchant | null
  isLoading: boolean
  login: (payload: LoginPayload) => Promise<void>
  signup: (payload: SignupPayload) => Promise<void>
  logout: () => void
  setSession: (user: AuthUser, merchant: AuthMerchant) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY),
  )
  const [user, setUser] = useState<AuthUser | null>(null)
  const [merchant, setMerchant] = useState<AuthMerchant | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setUser(null)
      setMerchant(null)
      setIsLoading(false)
      return
    }

    fetchSession(token)
      .then((session) => {
        setUser(session.user)
        setMerchant(session.merchant)
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        setToken(null)
        setUser(null)
        setMerchant(null)
      })
      .finally(() => setIsLoading(false))
  }, [token])

  const applySession = useCallback(
    (session: { accessToken: string; user: AuthUser; merchant: AuthMerchant }) => {
      localStorage.setItem(TOKEN_STORAGE_KEY, session.accessToken)
      setToken(session.accessToken)
      setUser(session.user)
      setMerchant(session.merchant)
    },
    [],
  )

  const login = useCallback(
    async (payload: LoginPayload) => {
      const session = await loginRequest(payload)
      applySession(session)
    },
    [applySession],
  )

  const signup = useCallback(
    async (payload: SignupPayload) => {
      const session = await signupRequest(payload)
      applySession(session)
    },
    [applySession],
  )

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    setUser(null)
    setMerchant(null)
  }, [])

  const setSession = useCallback(
    (nextUser: AuthUser, nextMerchant: AuthMerchant) => {
      setUser(nextUser)
      setMerchant(nextMerchant)
    },
    [],
  )

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        merchant,
        isLoading,
        login,
        signup,
        logout,
        setSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
