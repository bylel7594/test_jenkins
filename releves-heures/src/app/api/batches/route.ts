import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { imageToBase64, splitPdfToImages } from '@/lib/pdf/split'
import {
  extractTimesheet,
  calculateLineHours,
  computeTimesheetStatus,
} from '@/lib/claude/extract'
import type { AgencySettings } from '@/types'

// POST /api/batches — dépôt d'un ou plusieurs fichiers
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Charge le profil et les paramètres de l'agence
  const { data: userProfile } = await supabase
    .from('users')
    .select('agency_id')
    .eq('id', user.id)
    .single()
  if (!userProfile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const { data: agency } = await supabase
    .from('agencies')
    .select('settings')
    .eq('id', userProfile.agency_id)
    .single()

  const settings = (agency?.settings ?? {}) as AgencySettings
  const confidenceThreshold = settings.confidence_threshold ?? 0.85
  const lunchBreak = settings.lunch_break_enabled
    ? (settings.lunch_break_duration_minutes ?? 0)
    : 0

  const formData = await request.formData()
  const files = formData.getAll('files') as File[]
  if (!files.length) return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 })

  const results = []

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer())
    const mimeType = file.type

    // Upload du fichier original dans Supabase Storage
    const storagePath = `${userProfile.agency_id}/batches/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('timesheets')
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false })
    if (uploadError) {
      results.push({ filename: file.name, error: uploadError.message })
      continue
    }

    // Crée l'entrée batch
    const totalPages = mimeType === 'application/pdf'
      ? undefined // sera mis à jour après découpage
      : 1

    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .insert({
        agency_id: userProfile.agency_id,
        uploaded_by: user.id,
        original_filename: file.name,
        file_path: storagePath,
        status: 'processing',
        total_pages: totalPages,
        processed_pages: 0,
      })
      .select()
      .single()

    if (batchError || !batch) {
      results.push({ filename: file.name, error: batchError?.message })
      continue
    }

    // Découpe et extrait en arrière-plan (fire & forget)
    // On répond immédiatement avec le batch_id ; le client suit via Realtime
    processFileBatch({
      buffer,
      mimeType,
      batchId: batch.id,
      agencyId: userProfile.agency_id,
      userId: user.id,
      confidenceThreshold,
      lunchBreak,
      storagePath,
    }).catch(async (err) => {
      console.error('Erreur traitement batch', batch.id, err)
      await supabase
        .from('batches')
        .update({ status: 'error', error_message: String(err) })
        .eq('id', batch.id)
    })

    results.push({ filename: file.name, batch_id: batch.id, status: 'processing' })
  }

  return NextResponse.json({ batches: results })
}

async function processFileBatch(params: {
  buffer: Buffer
  mimeType: string
  batchId: string
  agencyId: string
  userId: string
  confidenceThreshold: number
  lunchBreak: number
  storagePath: string
}) {
  const {
    buffer,
    mimeType,
    batchId,
    agencyId,
    confidenceThreshold,
    lunchBreak,
    storagePath,
  } = params

  const supabase = await createClient()

  let pages: Array<{ pageNumber: number; base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' }>

  if (mimeType === 'application/pdf') {
    const pdfPages = await splitPdfToImages(buffer)
    pages = pdfPages
  } else {
    const img = await imageToBase64(buffer, mimeType)
    pages = [{ pageNumber: 1, ...img }]
  }

  // Met à jour total_pages
  await supabase
    .from('batches')
    .update({ total_pages: pages.length })
    .eq('id', batchId)

  for (const page of pages) {
    // Stocke l'image de la page si c'est un PDF
    let pageFilePath = storagePath
    if (pages.length > 1) {
      const pageBuffer = Buffer.from(page.base64, 'base64')
      pageFilePath = storagePath.replace(/\.pdf$/, '') + `-page${page.pageNumber}.jpg`
      await supabase.storage
        .from('timesheets')
        .upload(pageFilePath, pageBuffer, { contentType: 'image/jpeg', upsert: false })
    }

    // Crée le relevé en état "processing"
    const { data: timesheet } = await supabase
      .from('timesheets')
      .insert({
        batch_id: batchId,
        agency_id: agencyId,
        page_number: page.pageNumber,
        file_path: pageFilePath,
        status: 'processing',
      })
      .select()
      .single()

    if (!timesheet) continue

    try {
      const { data: extracted, raw } = await extractTimesheet(
        page.base64,
        page.mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
      )

      // Calcule les heures par ligne
      const lines = extracted.lines.map((line, idx) => ({
        timesheet_id: timesheet.id,
        agency_id: agencyId,
        line_order: idx,
        line_date: line.date,
        line_date_confidence: line.date_confidence,
        arrival_time: line.arrival_time,
        arrival_time_confidence: line.arrival_time_confidence,
        departure_time: line.departure_time,
        departure_time_confidence: line.departure_time_confidence,
        calculated_hours: calculateLineHours(line.arrival_time, line.departure_time, lunchBreak),
      }))

      const calculatedTotal = lines.reduce(
        (sum, l) => sum + (l.calculated_hours ?? 0),
        0
      )

      const status = computeTimesheetStatus(
        extracted,
        confidenceThreshold,
        calculatedTotal
      )

      // Sauvegarde les lignes
      if (lines.length > 0) {
        await supabase.from('timesheet_lines').insert(lines)
      }

      // Met à jour le relevé avec les données extraites
      await supabase
        .from('timesheets')
        .update({
          status,
          interim_name: extracted.interim_name,
          interim_name_confidence: extracted.interim_name_confidence,
          qualification: extracted.qualification,
          qualification_confidence: extracted.qualification_confidence,
          client_company: extracted.client_company,
          client_company_confidence: extracted.client_company_confidence,
          period_start: extracted.period_start,
          period_start_confidence: extracted.period_start_confidence,
          period_end: extracted.period_end,
          period_end_confidence: extracted.period_end_confidence,
          handwritten_total_hours: extracted.handwritten_total_hours,
          handwritten_total_confidence: extracted.handwritten_total_confidence,
          calculated_total_hours: Math.round(calculatedTotal * 100) / 100,
          baskets: extracted.baskets,
          baskets_confidence: extracted.baskets_confidence,
          transport: extracted.transport,
          transport_confidence: extracted.transport_confidence,
          bonuses: extracted.bonuses,
          bonuses_confidence: extracted.bonuses_confidence,
          extraction_raw: raw,
        })
        .eq('id', timesheet.id)
    } catch (err) {
      await supabase
        .from('timesheets')
        .update({ status: 'a_confirmer', extraction_raw: { error: String(err) } })
        .eq('id', timesheet.id)
    }

    // Incrémente le compteur de pages traitées
    await supabase.rpc('increment_processed_pages', { batch_id: batchId })
  }

  // Marque le batch comme terminé
  await supabase
    .from('batches')
    .update({ status: 'completed' })
    .eq('id', batchId)
}

// GET /api/batches — liste les batches de l'agence
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await supabase
    .from('batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ batches: data })
}
