import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

// Mock users for development (when DB is not configured)
const MOCK_USERS = [
  {
    id: 'user-admin',
    email: 'admin@fundamentaleiloes.com.br',
    password: '$2b$10$mMe7GOjGZTdr2coX5NJRG.W1gOQ3BdzhuoIfB3CjRqPdCyHBvSmva', // demo123
    name: 'Administrador',
    plan: 'PREMIUM',
    role: 'ADMIN',
  },
  {
    id: 'user-001',
    email: 'demo@fundamentaleiloes.com.br',
    password: '$2b$10$mMe7GOjGZTdr2coX5NJRG.W1gOQ3BdzhuoIfB3CjRqPdCyHBvSmva', // demo123
    name: 'Demo Investidor',
    plan: 'PREMIUM',
    role: 'USER',
  },
  {
    id: 'user-002',
    email: 'free@fundamentaleiloes.com.br',
    password: '$2b$10$mMe7GOjGZTdr2coX5NJRG.W1gOQ3BdzhuoIfB3CjRqPdCyHBvSmva', // demo123
    name: 'Usuário Free',
    plan: 'FREE',
    role: 'USER',
  },
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credenciais',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Try DB first
        try {
          const { prisma } = await import('@/lib/db');
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
          });

          if (user && user.password) {
            const isValid = await bcrypt.compare(
              credentials.password as string,
              user.password
            );
            if (isValid) {
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                plan: user.plan,
                role: 'USER',
              };
            }
          }
        } catch {
          // DB not available, fall through to mock users
        }

        // Fallback: mock users for development
        const mockUser = MOCK_USERS.find(
          (u) => u.email === credentials.email
        );
        if (mockUser) {
          const isValid = await bcrypt.compare(
            credentials.password as string,
            mockUser.password
          );
          if (isValid) {
            return {
              id: mockUser.id,
              email: mockUser.email,
              name: mockUser.name,
              plan: mockUser.plan,
              role: mockUser.role || 'USER',
            };
          }
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.plan = user.plan || 'FREE';
        token.role = user.role || 'USER';
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.plan = token.plan as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || 'fundamenta-secret-change-in-production',
});
