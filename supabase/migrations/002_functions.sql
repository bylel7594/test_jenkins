-- Incrémente le compteur de pages traitées dans un batch
CREATE OR REPLACE FUNCTION increment_processed_pages(batch_id UUID)
RETURNS VOID AS $$
  UPDATE batches
  SET processed_pages = processed_pages + 1
  WHERE id = batch_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Politique pour permettre l'appel de la fonction aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION increment_processed_pages TO authenticated;
