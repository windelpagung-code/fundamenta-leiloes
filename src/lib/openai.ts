import OpenAI from 'openai';

export const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function analyzeAuctionDocument(documentText: string): Promise<{
  occupationStatus: string;
  legalRisks: string[];
  legalSummary: string;
  marketAnalysis: string;
  recommendation: string;
  estimatedMarketValue?: number;
  estimatedEvictionCosts?: number;
}> {
  if (!openai) {
    return {
      occupationStatus: 'Não informado',
      legalRisks: ['Configure OPENAI_API_KEY para análise automática'],
      legalSummary: 'Análise de IA indisponível. Configure a chave da OpenAI API.',
      marketAnalysis: 'Configure OPENAI_API_KEY para análise de mercado automática.',
      recommendation: 'Configure a integração com OpenAI para obter análises detalhadas.',
    };
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Você é um especialista em leilões de imóveis no Brasil. Analise documentos de leilão (matrículas, editais) e retorne uma análise estruturada em JSON. Sempre responda em português brasileiro.`,
      },
      {
        role: 'user',
        content: `Analise o seguinte documento de leilão de imóvel e retorne um JSON com:
- occupationStatus: status de ocupação do imóvel ("Ocupado", "Desocupado" ou "Não Informado")
- legalRisks: array de riscos jurídicos identificados
- legalSummary: resumo jurídico em 2-3 parágrafos
- marketAnalysis: análise de mercado e potencial do imóvel
- recommendation: recomendação de investimento
- estimatedMarketValue: valor estimado de mercado em reais (número)
- estimatedEvictionCosts: estimativa de custos de desocupação em reais (número)

Documento:
${documentText}`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 2000,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('Resposta vazia da IA');

  return JSON.parse(content);
}
