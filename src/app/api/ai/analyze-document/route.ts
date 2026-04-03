import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { analyzeAuctionDocument } from '@/lib/openai';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const text = formData.get('text') as string | null;

    let documentText = text || '';

    if (file && !text) {
      // For PDF files, we'd use a PDF parsing library
      // For now, read as text if possible
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      // Simple text extraction attempt
      documentText = new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/[^\x20-\x7E\n\r\t\u00C0-\u024F]/g, ' ');
    }

    if (!documentText.trim()) {
      return NextResponse.json({ error: 'Conteúdo do documento não encontrado.' }, { status: 400 });
    }

    const analysis = await analyzeAuctionDocument(documentText);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('AI analysis error:', error);
    return NextResponse.json({ error: 'Erro na análise por IA. Verifique a chave da OpenAI API.' }, { status: 500 });
  }
}
