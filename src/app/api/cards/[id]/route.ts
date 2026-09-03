import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { updateCardStatus, deleteCard } from '@/lib/db'

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getAuthenticatedUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { status } = await request.json()
    const { id } = await params

    try {
        updateCardStatus.run(status, id, user.id)
        return NextResponse.json({ message: 'Card status updated' })
    } catch (error) {
        console.error('Error updating card:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getAuthenticatedUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    try {
        deleteCard.run(id, user.id)
        return NextResponse.json({ message: 'Card deleted' })
    } catch (error) {
        console.error('Error deleting card:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
