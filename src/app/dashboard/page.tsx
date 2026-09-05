import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Overview } from '@/components/Dashboard/Overview/Overview'

export default async function Dashboard() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return <Overview />
}