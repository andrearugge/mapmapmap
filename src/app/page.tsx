import { redirect } from 'next/navigation'
import { auth, signIn } from '@/auth'

export default async function LandingPage() {
  const session = await auth()
  if (session) redirect('/activity-picker')

  async function stravaSignIn() {
    'use server'
    await signIn('strava', { redirectTo: '/activity-picker' })
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">Mapmapmap</h1>
        <p className="text-lg text-muted-foreground">
          Turn your Strava activity into an Instagram Story.
        </p>
      </div>

      <form action={stravaSignIn}>
        <button
          type="submit"
          className="rounded-full bg-[#FC4C02] px-8 py-4 text-base font-semibold text-white shadow-md transition-opacity active:opacity-80"
        >
          Connect with Strava
        </button>
      </form>
    </main>
  )
}
