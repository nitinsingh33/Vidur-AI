import { useEffect, useState, type FormEvent } from 'react'
import { Building2, KeyRound, Loader2, LogOut, User } from 'lucide-react'
import { changePassword, updateProfile } from '../api/auth'
import { getMyMerchant, updateMyMerchant, type MerchantProfile } from '../api/merchants'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Skeleton } from '../components/ui/skeleton'
import { useAuth } from '../context/AuthContext'

function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof User
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon size={17} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </article>
  )
}

export function Settings() {
  const { token, user, merchant, setSession, logout } = useAuth()

  const [merchantProfile, setMerchantProfile] =
    useState<MerchantProfile | null>(null)
  const [loadingMerchant, setLoadingMerchant] = useState(true)

  const [name, setName] = useState(user?.name ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [workspaceName, setWorkspaceName] = useState('')
  const [savingWorkspace, setSavingWorkspace] = useState(false)
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    setName(user?.name ?? '')
  }, [user?.name])

  useEffect(() => {
    setWorkspaceName(merchant?.name ?? '')
  }, [merchant?.name])

  useEffect(() => {
    if (!token) return

    getMyMerchant(token)
      .then(setMerchantProfile)
      .catch(() => setMerchantProfile(null))
      .finally(() => setLoadingMerchant(false))
  }, [token])

  async function handleProfileSubmit(event: FormEvent) {
    event.preventDefault()
    if (!token || !user || !merchant) return

    try {
      setProfileError(null)
      setProfileMessage(null)
      setSavingProfile(true)
      const session = await updateProfile(token, name)
      setSession(session.user, session.merchant)
      setProfileMessage('Profile updated.')
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : 'Unable to update profile.',
      )
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleWorkspaceSubmit(event: FormEvent) {
    event.preventDefault()
    if (!token || !user || !merchant) return

    try {
      setWorkspaceError(null)
      setWorkspaceMessage(null)
      setSavingWorkspace(true)
      const updated = await updateMyMerchant(token, workspaceName)
      setSession(user, { id: updated.id, name: updated.name })
      setMerchantProfile((current) =>
        current ? { ...current, name: updated.name } : current,
      )
      setWorkspaceMessage('Workspace updated.')
    } catch (err) {
      setWorkspaceError(
        err instanceof Error ? err.message : 'Unable to update workspace.',
      )
    } finally {
      setSavingWorkspace(false)
    }
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault()
    if (!token) return

    try {
      setPasswordError(null)
      setPasswordMessage(null)
      setChangingPassword(true)
      await changePassword(token, currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setPasswordMessage('Password changed.')
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : 'Unable to change password.',
      )
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <section className="mx-auto max-w-3xl pb-12">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Workspace
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
          Manage your profile, workspace, and account security.
        </p>
      </div>

      <div className="mt-8 space-y-5">
        <SettingsCard
          icon={User}
          title="Profile"
          description="Your personal account details."
        >
          <form className="space-y-4" onSubmit={handleProfileSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email ?? ''} disabled />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <Input id="role" value={user?.role ?? ''} disabled />
            </div>

            {profileError && (
              <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {profileError}
              </div>
            )}
            {profileMessage && (
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                {profileMessage}
              </div>
            )}

            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                'Save profile'
              )}
            </Button>
          </form>
        </SettingsCard>

        <SettingsCard
          icon={Building2}
          title="Workspace"
          description="The merchant workspace your account belongs to."
        >
          {loadingMerchant ? (
            <Skeleton className="h-32 rounded-lg" />
          ) : (
            <form className="space-y-4" onSubmit={handleWorkspaceSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="workspaceName">Workspace name</Label>
                <Input
                  id="workspaceName"
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="workspaceEmail">Workspace email</Label>
                <Input
                  id="workspaceEmail"
                  value={merchantProfile?.email ?? ''}
                  disabled
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="workspaceCurrency">Currency</Label>
                <Input
                  id="workspaceCurrency"
                  value={merchantProfile?.currency ?? ''}
                  disabled
                />
              </div>

              {workspaceError && (
                <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {workspaceError}
                </div>
              )}
              {workspaceMessage && (
                <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                  {workspaceMessage}
                </div>
              )}

              <Button type="submit" disabled={savingWorkspace}>
                {savingWorkspace ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  'Save workspace'
                )}
              </Button>
            </form>
          )}
        </SettingsCard>

        <SettingsCard
          icon={KeyRound}
          title="Security"
          description="Change your account password."
        >
          <form className="space-y-4" onSubmit={handlePasswordSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </div>

            {passwordError && (
              <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {passwordError}
              </div>
            )}
            {passwordMessage && (
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                {passwordMessage}
              </div>
            )}

            <Button type="submit" disabled={changingPassword}>
              {changingPassword ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                'Change password'
              )}
            </Button>
          </form>
        </SettingsCard>

        <article className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 p-6">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Log out
            </h2>
            <p className="text-xs text-muted-foreground">
              End your session on this device.
            </p>
          </div>
          <Button variant="outline" onClick={logout}>
            <LogOut size={15} />
            Log out
          </Button>
        </article>
      </div>
    </section>
  )
}
