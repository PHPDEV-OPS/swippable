import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { updateUserKycStatus } from '@/lib/db'

export async function GET() {
    const user = await getAuthenticatedUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ kyc_status: user.kyc_status || 'PENDING' })
}

export async function POST(request: Request) {
    const user = await getAuthenticatedUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Mock Email Verification Logic
    // In a real app, this would trigger an email with a verification link.
    // For this demo, we'll simulate the verification process being initiated or completed.
    
    const { action } = await request.json();

    if (action === 'verify_email') {
        // Simulate successful verification
        await updateUserKycStatus('VERIFIED', user.id);
        return NextResponse.json({ message: 'Email verified successfully', status: 'VERIFIED' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
