-- Bucket de stockage des images de relevés
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'timesheets',
  'timesheets',
  false,
  52428800, -- 50 Mo max par fichier
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Politique de stockage : lecture/écriture uniquement pour les utilisateurs de l'agence propriétaire
-- Le chemin commence toujours par {agency_id}/...
CREATE POLICY "storage_agency_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'timesheets'
    AND (storage.foldername(name))[1] = auth_agency_id()::text
  );

CREATE POLICY "storage_agency_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'timesheets'
    AND (storage.foldername(name))[1] = auth_agency_id()::text
  );

CREATE POLICY "storage_agency_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'timesheets'
    AND (storage.foldername(name))[1] = auth_agency_id()::text
  );
