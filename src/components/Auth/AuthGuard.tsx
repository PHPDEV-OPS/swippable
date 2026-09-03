'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Loader from '../Common/Loader'

interface AuthGuardProps {
  children: React.ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/signin')
    }
  }, [session, status, router])

  if (status === 'loading') {
    return <Loader />
  }

  if (!session) {
    return null
  }

  return <>{children}</>
}