-- Activer les extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- AGENCIES
-- ============================================================
CREATE TABLE agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  export_config JSONB NOT NULL DEFAULT '{
    "separator": ";",
    "date_format": "DD/MM/YYYY",
    "duration_format": "decimal",
    "columns": []
  }',
  settings JSONB NOT NULL DEFAULT '{
    "lunch_break_enabled": false,
    "lunch_break_duration_minutes": 60,
    "confidence_threshold": 0.85
  }',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USERS (extends auth.users)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('gestionnaire', 'responsable')),
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BATCHES (lots de dépôt)
-- ============================================================
CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'processing', 'completed', 'error')),
  total_pages INT,
  processed_pages INT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TIMESHEETS (relevés d'heures — une ligne par page)
-- ============================================================
CREATE TABLE timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  page_number INT,
  file_path TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'conforme', 'ecart', 'a_confirmer', 'valide')),

  -- En-tête extraite
  interim_name TEXT,
  interim_name_confidence FLOAT CHECK (interim_name_confidence BETWEEN 0 AND 1),
  qualification TEXT,
  qualification_confidence FLOAT CHECK (qualification_confidence BETWEEN 0 AND 1),
  client_company TEXT,
  client_company_confidence FLOAT CHECK (client_company_confidence BETWEEN 0 AND 1),
  period_start DATE,
  period_start_confidence FLOAT CHECK (period_start_confidence BETWEEN 0 AND 1),
  period_end DATE,
  period_end_confidence FLOAT CHECK (period_end_confidence BETWEEN 0 AND 1),

  -- Totaux (le handwritten ne doit jamais être écrasé par le calculé)
  handwritten_total_hours FLOAT,
  handwritten_total_confidence FLOAT CHECK (handwritten_total_confidence BETWEEN 0 AND 1),
  calculated_total_hours FLOAT,

  -- Indemnités
  baskets FLOAT DEFAULT 0,
  baskets_confidence FLOAT CHECK (baskets_confidence BETWEEN 0 AND 1),
  transport FLOAT DEFAULT 0,
  transport_confidence FLOAT CHECK (transport_confidence BETWEEN 0 AND 1),
  bonuses FLOAT DEFAULT 0,
  bonuses_confidence FLOAT CHECK (bonuses_confidence BETWEEN 0 AND 1),

  -- Réponse brute Claude (pour audit et amélioration future)
  extraction_raw JSONB,

  -- Validation humaine obligatoire
  validated_by UUID REFERENCES users(id),
  validated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TIMESHEET_LINES (lignes journalières)
-- ============================================================
CREATE TABLE timesheet_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id UUID NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  line_order INT NOT NULL,

  line_date DATE,
  line_date_confidence FLOAT CHECK (line_date_confidence BETWEEN 0 AND 1),
  arrival_time TIME,
  arrival_time_confidence FLOAT CHECK (arrival_time_confidence BETWEEN 0 AND 1),
  departure_time TIME,
  departure_time_confidence FLOAT CHECK (departure_time_confidence BETWEEN 0 AND 1),
  calculated_hours FLOAT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (timesheet_id, line_order)
);

-- ============================================================
-- CORRECTIONS (journal d'audit immuable)
-- ============================================================
CREATE TABLE corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id UUID NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  field_path TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  corrected_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRIGGER : updated_at automatique sur timesheets
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER timesheets_updated_at
  BEFORE UPDATE ON timesheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- INDEX
-- ============================================================
CREATE INDEX idx_timesheets_agency_status ON timesheets (agency_id, status);
CREATE INDEX idx_timesheets_batch ON timesheets (batch_id);
CREATE INDEX idx_timesheet_lines_timesheet ON timesheet_lines (timesheet_id, line_order);
CREATE INDEX idx_corrections_timesheet ON corrections (timesheet_id, created_at);
CREATE INDEX idx_batches_agency ON batches (agency_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE corrections ENABLE ROW LEVEL SECURITY;

-- Helper : récupère l'agency_id de l'utilisateur connecté
CREATE OR REPLACE FUNCTION auth_agency_id()
RETURNS UUID AS $$
  SELECT agency_id FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- agencies : lecture seule de sa propre agence
CREATE POLICY agencies_select ON agencies
  FOR SELECT USING (id = auth_agency_id());

CREATE POLICY agencies_update ON agencies
  FOR UPDATE USING (id = auth_agency_id());

-- users : voir uniquement les membres de sa propre agence
CREATE POLICY users_select ON users
  FOR SELECT USING (agency_id = auth_agency_id());

-- batches
CREATE POLICY batches_all ON batches
  FOR ALL USING (agency_id = auth_agency_id());

-- timesheets
CREATE POLICY timesheets_all ON timesheets
  FOR ALL USING (agency_id = auth_agency_id());

-- timesheet_lines
CREATE POLICY timesheet_lines_all ON timesheet_lines
  FOR ALL USING (agency_id = auth_agency_id());

-- corrections
CREATE POLICY corrections_all ON corrections
  FOR ALL USING (agency_id = auth_agency_id());
