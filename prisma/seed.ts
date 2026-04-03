import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create demo users
  const hashedPassword = await bcrypt.hash('demo123', 10);

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@fundamentaleiloes.com.br' },
    update: {},
    create: {
      email: 'demo@fundamentaleiloes.com.br',
      name: 'Demo Investidor',
      password: hashedPassword,
      plan: 'PREMIUM',
    },
  });

  await prisma.user.upsert({
    where: { email: 'free@fundamentaleiloes.com.br' },
    update: {},
    create: {
      email: 'free@fundamentaleiloes.com.br',
      name: 'Usuário Free',
      password: hashedPassword,
      plan: 'FREE',
    },
  });

  console.log('Users created:', demoUser.email);

  // Create sample properties
  const properties = [
    {
      title: 'Apartamento 3 quartos - Vila Madalena',
      description: 'Excelente apartamento no coração da Vila Madalena, 85m² com 3 quartos.',
      mainImage: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800',
      address: 'Rua Girassol, 450, Apto 82',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '05433-000',
      latitude: -23.5604,
      longitude: -46.6933,
      marketValue: 680000,
      initialBid: 374000,
      discountPercentage: 45,
      auctionDate: new Date('2026-03-25T10:00:00Z'),
      auctionTime: '10:00',
      occupationStatus: 'VACANT' as const,
      propertyType: 'APARTMENT' as const,
      sourceBank: 'Caixa Econômica Federal',
      sourceAuctioneer: 'Zuk Leilões',
      areaTotal: 85,
      areaPrivate: 78,
    },
    {
      title: 'Casa 4 quartos com piscina - Alphaville',
      description: 'Magnífica casa em condomínio fechado de alto padrão em Alphaville.',
      mainImage: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800',
      address: 'Alameda Madeiras, 1200',
      city: 'Barueri',
      state: 'SP',
      latitude: -23.5015,
      longitude: -46.8481,
      marketValue: 2100000,
      initialBid: 1050000,
      discountPercentage: 50,
      auctionDate: new Date('2026-04-10T14:00:00Z'),
      auctionTime: '14:00',
      occupationStatus: 'OCCUPIED' as const,
      propertyType: 'HOUSE' as const,
      sourceBank: 'Itaú',
      sourceAuctioneer: 'Mega Leilões',
      areaTotal: 450,
      areaPrivate: 320,
    },
    {
      title: 'Terreno 500m² - Bairro Jardim América',
      description: 'Terreno plano com 500m² em bairro nobre, totalmente murado.',
      mainImage: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800',
      address: 'Rua das Acácias, 340',
      city: 'Curitiba',
      state: 'PR',
      latitude: -25.4290,
      longitude: -49.2671,
      marketValue: 420000,
      initialBid: 210000,
      discountPercentage: 50,
      auctionDate: new Date('2026-03-30T09:00:00Z'),
      auctionTime: '09:00',
      occupationStatus: 'VACANT' as const,
      propertyType: 'LAND' as const,
      sourceBank: 'Banco do Brasil',
      sourceAuctioneer: 'Sodré Santoro',
      areaTotal: 500,
    },
  ];

  for (const propertyData of properties) {
    const property = await prisma.property.create({ data: propertyData });

    await prisma.auction.create({
      data: {
        propertyId: property.id,
        auctioneerName: propertyData.sourceAuctioneer || 'Leiloeiro Oficial',
        modalidade: '2º Leilão',
      },
    });

    console.log('Property created:', property.title);
  }

  // Create a sample journal entry
  const firstProperty = await prisma.property.findFirst();
  if (firstProperty) {
    await prisma.bidderJournal.create({
      data: {
        userId: demoUser.id,
        propertyId: firstProperty.id,
        evictionStatus: 'COMPLETED',
        acquiredValue: firstProperty.initialBid,
        actualDocumentationCosts: 18500,
        actualRenovationCosts: 42000,
        targetSaleValue: 580000,
        notes: 'Imóvel em ótimas condições.',
      },
    });
  }

  console.log('Seed complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
