import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { mockProperties, filterProperties } from '@/lib/mockData';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const filters = {
    state: searchParams.get('state') || undefined,
    propertyType: searchParams.get('propertyType') as never || undefined,
    minValue: searchParams.get('minValue') ? Number(searchParams.get('minValue')) : undefined,
    maxValue: searchParams.get('maxValue') ? Number(searchParams.get('maxValue')) : undefined,
    sourceBank: searchParams.get('sourceBank') || undefined,
    sourceAuctioneer: searchParams.get('sourceAuctioneer') || undefined,
    occupationStatus: searchParams.get('occupationStatus') as never || undefined,
    search: searchParams.get('search') || undefined,
  };

  try {
    const { prisma } = await import('@/lib/db');
    const where: Record<string, unknown> = { active: true };

    if (filters.state) where.state = filters.state;
    if (filters.propertyType) where.propertyType = filters.propertyType;
    if (filters.sourceBank) where.sourceBank = filters.sourceBank;
    if (filters.occupationStatus) where.occupationStatus = filters.occupationStatus;
    if (filters.minValue || filters.maxValue) {
      where.initialBid = {
        ...(filters.minValue ? { gte: filters.minValue } : {}),
        ...(filters.maxValue ? { lte: filters.maxValue } : {}),
      };
    }

    const properties = await prisma.property.findMany({
      where,
      include: { auction: true },
      orderBy: { auctionDate: 'asc' },
    });

    return NextResponse.json(properties);
  } catch {
    // Fallback to mock data
    const properties = filterProperties(mockProperties, filters);
    return NextResponse.json(properties);
  }
}
