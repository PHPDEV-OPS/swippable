import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { findUserByEmail, updateUserKycStatus } from '@/lib/db'

export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = findUserByEmail.get(session.user.email) as any
    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ kyc_status: user.kyc_status || 'PENDING' })
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = findUserByEmail.get(session.user.email) as any
    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Mock Email Verification Logic
    // In a real app, this would trigger an email with a verification link.
    // For this demo, we'll simulate the verification process being initiated or completed.
    
    const { action } = await request.json();

    if (action === 'verify_email') {
        // Simulate successful verification
        updateUserKycStatus.run('VERIFIED', user.id);
        return NextResponse.json({ message: 'Email verified successfully', status: 'VERIFIED' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
