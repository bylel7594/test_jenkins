export type UserRole = 'gestionnaire' | 'responsable'

export type BatchStatus = 'uploading' | 'processing' | 'completed' | 'error'

export type TimesheetStatus = 'processing' | 'conforme' | 'ecart' | 'a_confirmer' | 'valide'

export interface Agency {
  id: string
  name: string
  slug: string
  export_config: ExportConfig
  settings: AgencySettings
  created_at: string
}

export interface ExportConfig {
  separator: ',' | ';' | '\t'
  date_format: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY'
  duration_format: 'decimal' | 'HH:MM'
  columns: ExportColumn[]
}

export interface ExportColumn {
  key: string
  label: string
  enabled: boolean
  order: number
}

export interface AgencySettings {
  lunch_break_enabled: boolean
  lunch_break_duration_minutes: number
  confidence_threshold: number
}

export interface User {
  id: string
  agency_id: string
  role: UserRole
  full_name: string | null
  created_at: string
}

export interface Batch {
  id: string
  agency_id: string
  uploaded_by: string
  original_filename: string
  file_path: string
  status: BatchStatus
  total_pages: number | null
  processed_pages: number
  created_at: string
}

export interface Timesheet {
  id: string
  batch_id: string | null
  agency_id: string
  page_number: number | null
  file_path: string
  status: TimesheetStatus

  // En-tête
  interim_name: string | null
  interim_name_confidence: number | null
  qualification: string | null
  qualification_confidence: number | null
  client_company: string | null
  client_company_confidence: number | null
  period_start: string | null
  period_start_confidence: number | null
  period_end: string | null
  period_end_confidence: number | null

  // Totaux
  handwritten_total_hours: number | null
  handwritten_total_confidence: number | null
  calculated_total_hours: number | null

  // Indemnités
  baskets: number | null
  baskets_confidence: number | null
  transport: number | null
  transport_confidence: number | null
  bonuses: number | null
  bonuses_confidence: number | null

  extraction_raw: ExtractionRaw | null

  validated_by: string | null
  validated_at: string | null

  created_at: string
  updated_at: string

  lines?: TimesheetLine[]
}

export interface TimesheetLine {
  id: string
  timesheet_id: string
  line_order: number
  line_date: string | null
  line_date_confidence: number | null
  arrival_time: string | null
  arrival_time_confidence: number | null
  departure_time: string | null
  departure_time_confidence: number | null
  calculated_hours: number | null
  created_at: string
}

export interface Correction {
  id: string
  timesheet_id: string
  field_path: string
  old_value: string | null
  new_value: string | null
  corrected_by: string
  created_at: string
}

export interface ExtractionRaw {
  model: string
  usage: { input_tokens: number; output_tokens: number }
  extracted_at: string
}

export interface TimesheetWithStats extends Timesheet {
  gap_hours: number | null
  low_confidence_fields: string[]
}

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  separator: ';',
  date_format: 'DD/MM/YYYY',
  duration_format: 'decimal',
  columns: [
    { key: 'interim_name', label: 'Intérimaire', enabled: true, order: 0 },
    { key: 'qualification', label: 'Qualification', enabled: true, order: 1 },
    { key: 'client_company', label: 'Entreprise utilisatrice', enabled: true, order: 2 },
    { key: 'period_start', label: 'Début de mission', enabled: true, order: 3 },
    { key: 'period_end', label: 'Fin de mission', enabled: true, order: 4 },
    { key: 'handwritten_total_hours', label: 'Total écrit', enabled: true, order: 5 },
    { key: 'calculated_total_hours', label: 'Total calculé', enabled: true, order: 6 },
    { key: 'baskets', label: 'Paniers', enabled: true, order: 7 },
    { key: 'transport', label: 'Déplacements', enabled: true, order: 8 },
    { key: 'bonuses', label: 'Primes', enabled: true, order: 9 },
    { key: 'validated_at', label: 'Date de validation', enabled: true, order: 10 },
  ],
}

export const DEFAULT_AGENCY_SETTINGS: AgencySettings = {
  lunch_break_enabled: false,
  lunch_break_duration_minutes: 60,
  confidence_threshold: 0.85,
}
