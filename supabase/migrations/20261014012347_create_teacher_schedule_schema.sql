/*
# Schéma de l'application de gestion des emplois du temps enseignants

## Description générale
Cette migration crée le schéma de base de données pour une application permettant aux enseignants 
de soumettre leur emploi du temps hebdomadaire (lundi au vendredi) sans compte, et à un 
administrateur de consulter toutes les soumissions après connexion sécurisée.

## Nouvelles tables

### 1. `teachers` — Enseignants
- `id` (uuid, clé primaire, auto-généré)
- `last_name` (text, non null) — Nom de l'enseignant
- `first_names` (text, non null) — Prénom(s)
- `professional_status` (text, non null) — Statut professionnel (ex: titulaire, vacataire, etc.)
- `establishments` (text, non null) — Établissement(s) où enseigne l'enseignant
- `created_at` (timestamptz, défaut now())

### 2. `schedule_days` — Journées par enseignant
- `id` (uuid, clé primaire, auto-généré)
- `teacher_id` (uuid, non null, référence `teachers.id` ON DELETE CASCADE)
- `day_of_week` (smallint, non null) — Jour de la semaine: 0=lundi, 1=mardi, 2=mercredi, 3=jeudi, 4=vendredi
- `has_courses` (boolean, non null, défaut true) — false si "Pas de cours" ce jour-là
- Contrainte d'unicité: (teacher_id, day_of_week) — un enseignant ne peut avoir qu'une entrée par jour

### 3. `schedule_slots` — Créneaux horaires
- `id` (uuid, clé primaire, auto-généré)
- `day_id` (uuid, non null, référence `schedule_days.id` ON DELETE CASCADE)
- `start_time` (time, non null) — Heure de début
- `end_time` (time, non null) — Heure de fin
- `class_name` (text, non null) — Classe concernée
- `establishment` (text, non null) — Établissement pour ce créneau

### 4. `schedule_slot_audit` — Audit pour la fonction RPC (table technique)
Aucune table d'audit distincte n'est créée. La fonction RPC utilise la table `teachers` directement.

## Sécurité (RLS)

### Table `teachers`
- RLS activée.
- INSERT: autorisé pour `anon, authenticated` (le formulaire enseignant est public, soumission via API route).
- SELECT, UPDATE, DELETE: réservés à `authenticated` (admin connecté uniquement).

### Table `schedule_days`
- RLS activée.
- INSERT: autorisé pour `anon, authenticated` (via la fonction RPC qui tourne en SECURITY DEFINER).
- SELECT, UPDATE, DELETE: réservés à `authenticated` (admin connecté uniquement).

### Table `schedule_slots`
- RLS activée.
- INSERT: autorisé pour `anon, authenticated` (via la fonction RPC).
- SELECT, UPDATE, DELETE: réservés à `authenticated` (admin connecté uniquement).

## Fonction RPC (SECURITY DEFINER)

### `submit_teacher_schedule(data jsonb)`
Cette fonction permet l'insertion atomique d'une soumission complète d'enseignant:
1. Insère l'enseignant dans `teachers`.
2. Pour chaque jour (lundi à vendredi), insère une entrée dans `schedule_days`.
3. Si le jour a des cours, insère chaque créneau dans `schedule_slots`.
4. Tout se fait dans un seul bloc PL/pgSQL (transaction implicite).
5. Si une erreur survient, tout est annulé automatiquement.

La fonction est `SECURITY DEFINER` pour pouvoir écrire dans les tables malgré les politiques RLS restrictives.
Exécution accordée au rôle `anon` et `authenticated`.

## Notes importantes

1. Les soumissions passent par la route API Next.js qui appelle cette fonction RPC.
2. La clé `service_role` est utilisée côté serveur uniquement (jamais côté client).
3. Aucune consultation publique des réponses — seul l'administrateur connecté peut consulter.
4. La fonction RPC garantit l'atomicité: soit tout est enregistré, soit rien.
*/

-- ============================================================
-- Table: teachers
-- ============================================================
CREATE TABLE IF NOT EXISTS teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  last_name text NOT NULL,
  first_names text NOT NULL,
  professional_status text NOT NULL,
  establishments text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- DROP existing policies if any (idempotent)
DROP POLICY IF EXISTS "anon_insert_teachers" ON teachers;
DROP POLICY IF EXISTS "auth_select_teachers" ON teachers;
DROP POLICY IF EXISTS "auth_update_teachers" ON teachers;
DROP POLICY IF EXISTS "auth_delete_teachers" ON teachers;

-- INSERT: public (anon + authenticated) — the form is accessible without account
CREATE POLICY "anon_insert_teachers"
ON teachers FOR INSERT
TO anon, authenticated WITH CHECK (true);

-- SELECT: authenticated only (admin)
CREATE POLICY "auth_select_teachers"
ON teachers FOR SELECT
TO authenticated USING (true);

-- UPDATE: authenticated only (admin)
CREATE POLICY "auth_update_teachers"
ON teachers FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

-- DELETE: authenticated only (admin)
CREATE POLICY "auth_delete_teachers"
ON teachers FOR DELETE
TO authenticated USING (true);

-- ============================================================
-- Table: schedule_days
-- ============================================================
CREATE TABLE IF NOT EXISTS schedule_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 4),
  has_courses boolean NOT NULL DEFAULT true,
  UNIQUE(teacher_id, day_of_week)
);

ALTER TABLE schedule_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_schedule_days" ON schedule_days;
DROP POLICY IF EXISTS "auth_select_schedule_days" ON schedule_days;
DROP POLICY IF EXISTS "auth_update_schedule_days" ON schedule_days;
DROP POLICY IF EXISTS "auth_delete_schedule_days" ON schedule_days;

CREATE POLICY "anon_insert_schedule_days"
ON schedule_days FOR INSERT
TO anon, authenticated WITH CHECK (true);

CREATE POLICY "auth_select_schedule_days"
ON schedule_days FOR SELECT
TO authenticated USING (true);

CREATE POLICY "auth_update_schedule_days"
ON schedule_days FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_delete_schedule_days"
ON schedule_days FOR DELETE
TO authenticated USING (true);

-- ============================================================
-- Table: schedule_slots
-- ============================================================
CREATE TABLE IF NOT EXISTS schedule_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid NOT NULL REFERENCES schedule_days(id) ON DELETE CASCADE,
  start_time time NOT NULL,
  end_time time NOT NULL,
  class_name text NOT NULL,
  establishment text NOT NULL,
  CONSTRAINT slots_time_order CHECK (end_time > start_time)
);

ALTER TABLE schedule_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_schedule_slots" ON schedule_slots;
DROP POLICY IF EXISTS "auth_select_schedule_slots" ON schedule_slots;
DROP POLICY IF EXISTS "auth_update_schedule_slots" ON schedule_slots;
DROP POLICY IF EXISTS "auth_delete_schedule_slots" ON schedule_slots;

CREATE POLICY "anon_insert_schedule_slots"
ON schedule_slots FOR INSERT
TO anon, authenticated WITH CHECK (true);

CREATE POLICY "auth_select_schedule_slots"
ON schedule_slots FOR SELECT
TO authenticated USING (true);

CREATE POLICY "auth_update_schedule_slots"
ON schedule_slots FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_delete_schedule_slots"
ON schedule_slots FOR DELETE
TO authenticated USING (true);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_schedule_days_teacher_id ON schedule_days(teacher_id);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_day_id ON schedule_slots(day_id);
CREATE INDEX IF NOT EXISTS idx_teachers_last_name ON teachers(last_name);

-- ============================================================
-- Function: submit_teacher_schedule (SECURITY DEFINER)
-- Inserts a complete teacher submission atomically.
-- ============================================================
CREATE OR REPLACE FUNCTION submit_teacher_schedule(data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id uuid;
  v_day jsonb;
  v_slot jsonb;
  v_day_id uuid;
  v_day_of_week int;
  v_has_courses boolean;
  v_day_num int;
BEGIN
  -- 1. Insert teacher
  INSERT INTO teachers (last_name, first_names, professional_status, establishments)
  VALUES (
    data->>'last_name',
    data->>'first_names',
    data->>'professional_status',
    data->>'establishments'
  )
  RETURNING id INTO v_teacher_id;

  -- 2. Process each day (days is an array of day objects)
  IF jsonb_typeof(data->'days') != 'array' THEN
    RAISE EXCEPTION 'Le champ "days" doit être un tableau';
  END IF;

  FOR v_day_num IN 0..4 LOOP
    -- Find the day entry for this day_of_week
    v_day := NULL;
    FOR v_day IN SELECT * FROM jsonb_array_elements(data->'days') LOOP
      IF (v_day->>'day_of_week')::int = v_day_num THEN
        EXIT;
      END IF;
      v_day := NULL;
    END LOOP;

    -- If no entry found for this day, skip (shouldn't happen if client sends all 5 days)
    IF v_day IS NULL THEN
      CONTINUE;
    END IF;

    v_has_courses := COALESCE((v_day->>'has_courses')::boolean, true);

    -- Insert the day
    INSERT INTO schedule_days (teacher_id, day_of_week, has_courses)
    VALUES (v_teacher_id, v_day_num, v_has_courses)
    RETURNING id INTO v_day_id;

    -- If the day has courses, insert each slot
    IF v_has_courses AND jsonb_typeof(v_day->'slots') = 'array' THEN
      FOR v_slot IN SELECT * FROM jsonb_array_elements(v_day->'slots') LOOP
        INSERT INTO schedule_slots (day_id, start_time, end_time, class_name, establishment)
        VALUES (
          v_day_id,
          (v_slot->>'start_time')::time,
          (v_slot->>'end_time')::time,
          v_slot->>'class_name',
          v_slot->>'establishment'
        );
      END LOOP;
    END IF;
  END LOOP;

  RETURN v_teacher_id;
END;
$$;

-- Grant execution to anon and authenticated
GRANT EXECUTE ON FUNCTION submit_teacher_schedule(jsonb) TO anon, authenticated;