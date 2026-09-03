import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { Overview } from '@/components/Dashboard/Overview/Overview'

export default async function Dashboard() {
  const session = await getServerSession()

  if (!session) {
    redirect('/')
  }

  return <Overview />
}