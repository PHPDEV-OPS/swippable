import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get('ids') || 'bitcoin,ethereum,solana,usd-coin';
  const vs_currencies = searchParams.get('vs_currencies') || 'usd';

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${vs_currencies}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 60 } // Cache for 60 seconds
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch prices');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching crypto prices:', error);
    // Fallback data in case of error (e.g. rate limit)
    return NextResponse.json({
      bitcoin: { usd: 95000 },
      ethereum: { usd: 3500 },
      solana: { usd: 150 },
      'usd-coin': { usd: 1.00 }
    });
  }
}
