import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios.' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const { prisma } = await import('@/lib/db');

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json({ error: 'Este email já está cadastrado.' }, { status: 400 });
      }

      await prisma.user.create({
        data: { name, email, password: hashedPassword },
      });

      return NextResponse.json({ message: 'Conta criada com sucesso!' });
    } catch {
      // DB not configured - return success for demo mode
      return NextResponse.json({ message: 'Conta criada com sucesso! (Modo demo - configure o banco de dados para persistência)' });
    }
  } catch {
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 });
  }
}
