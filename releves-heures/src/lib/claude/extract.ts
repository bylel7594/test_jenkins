import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Schéma de sortie structuré pour l'extraction
const TimesheetLineSchema = z.object({
  date: z.string().nullable().describe('Date au format YYYY-MM-DD ou null si illisible'),
  date_confidence: z.number().min(0).max(1),
  arrival_time: z.string().nullable().describe('Heure d\'arrivée HH:MM ou null'),
  arrival_time_confidence: z.number().min(0).max(1),
  departure_time: z.string().nullable().describe('Heure de départ HH:MM ou null'),
  departure_time_confidence: z.number().min(0).max(1),
})

const ExtractionOutputSchema = z.object({
  interim_name: z.string().nullable(),
  interim_name_confidence: z.number().min(0).max(1),
  qualification: z.string().nullable(),
  qualification_confidence: z.number().min(0).max(1),
  client_company: z.string().nullable(),
  client_company_confidence: z.number().min(0).max(1),
  period_start: z.string().nullable().describe('Date ISO YYYY-MM-DD ou null'),
  period_start_confidence: z.number().min(0).max(1),
  period_end: z.string().nullable().describe('Date ISO YYYY-MM-DD ou null'),
  period_end_confidence: z.number().min(0).max(1),
  handwritten_total_hours: z.number().nullable().describe('Total écrit à la main en heures décimales'),
  handwritten_total_confidence: z.number().min(0).max(1),
  baskets: z.number().nullable().describe('Nombre de paniers repas'),
  baskets_confidence: z.number().min(0).max(1),
  transport: z.number().nullable().describe('Montant ou nombre de déplacements'),
  transport_confidence: z.number().min(0).max(1),
  bonuses: z.number().nullable().describe('Montant des primes'),
  bonuses_confidence: z.number().min(0).max(1),
  lines: z.array(TimesheetLineSchema).describe('Une entrée par jour travaillé'),
})

export type ExtractionOutput = z.infer<typeof ExtractionOutputSchema>

const SYSTEM_PROMPT = `Tu es un expert en lecture de relevés d'heures manuscrits pour agences d'intérim françaises.
Tu extrais les données avec précision et tu attribues à chaque champ un indice de confiance entre 0 et 1.

Règles d'extraction :
- confiance = 1.0 : champ parfaitement lisible, sans ambiguïté
- confiance entre 0.85 et 0.99 : lisible mais avec légère incertitude
- confiance < 0.85 : difficile à lire, ambigu, ou partiellement visible → champ à confirmer
- Laisse null si le champ est totalement illisible ou absent
- Les heures manuscrites acceptent ces formats : "8h", "8h30", "8:30", "08h00", "8 h 30"
  Convertis toujours en HH:MM
- Le total écrit à la main est celui indiqué par l'intérimaire, pas celui que tu calcules
- Ne calcule jamais les heures toi-même ; laisse le système le faire
- Pour les dates : convertis au format YYYY-MM-DD
- Si une ligne est vide (pas travaillé), ne l'inclus pas dans les lignes`

export async function extractTimesheet(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
): Promise<{ data: ExtractionOutput; raw: object }> {
  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 },
          },
          {
            type: 'text',
            text: `Extrais toutes les informations de ce relevé d'heures.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans explication.
Le JSON doit correspondre exactement à cette structure :
${JSON.stringify(ExtractionOutputSchema.shape, null, 2)}`,
          },
        ],
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Aucun texte dans la réponse Claude')
  }

  // Nettoie les balises markdown éventuelles
  const jsonText = textBlock.text
    .replace(/^```json\n?/, '')
    .replace(/\n?```$/, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error(`JSON invalide reçu de Claude : ${jsonText.slice(0, 200)}`)
  }

  const validated = ExtractionOutputSchema.parse(parsed)

  const raw = {
    model: response.model,
    usage: response.usage,
    extracted_at: new Date().toISOString(),
  }

  return { data: validated, raw }
}

// Calcule les heures d'une ligne (départ - arrivée)
export function calculateLineHours(
  arrival: string | null,
  departure: string | null,
  lunchBreakMinutes = 0
): number | null {
  if (!arrival || !departure) return null
  const [ah, am] = arrival.split(':').map(Number)
  const [dh, dm] = departure.split(':').map(Number)
  const totalMinutes = (dh * 60 + dm) - (ah * 60 + am) - lunchBreakMinutes
  return totalMinutes > 0 ? Math.round(totalMinutes / 6) / 10 : null
}

// Détermine le statut du relevé selon les données extraites
export function computeTimesheetStatus(
  data: ExtractionOutput,
  confidenceThreshold: number,
  calculatedTotal: number | null
): 'conforme' | 'ecart' | 'a_confirmer' {
  const allFields = [
    data.interim_name_confidence,
    data.qualification_confidence,
    data.client_company_confidence,
    data.period_start_confidence,
    data.period_end_confidence,
    data.handwritten_total_confidence,
    ...data.lines.flatMap((l) => [
      l.date_confidence,
      l.arrival_time_confidence,
      l.departure_time_confidence,
    ]),
  ]

  const hasLowConfidence = allFields.some(
    (c) => c !== null && c < confidenceThreshold
  )
  const hasMissingRequired =
    data.interim_name === null ||
    data.client_company === null ||
    data.period_start === null

  if (hasLowConfidence || hasMissingRequired) return 'a_confirmer'

  if (
    data.handwritten_total_hours !== null &&
    calculatedTotal !== null &&
    Math.abs(data.handwritten_total_hours - calculatedTotal) > 0.01
  ) {
    return 'ecart'
  }

  return 'conforme'
}
