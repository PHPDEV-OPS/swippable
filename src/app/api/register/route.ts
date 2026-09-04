import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    return NextResponse.json({ error: 'Registration is managed by Clerk' }, { status: 410 })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
