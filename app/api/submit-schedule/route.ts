import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

function validateSubmission(data: any): string | null {
  if (!data || typeof data !== 'object') {
    return 'Données invalides';
  }

  const { last_name, first_names, professional_status, establishments, days } = data;

  if (!last_name || typeof last_name !== 'string' || last_name.trim().length < 2) {
    return 'Le nom est obligatoire (minimum 2 caractères)';
  }
  if (!first_names || typeof first_names !== 'string' || first_names.trim().length < 2) {
    return 'Le prénom est obligatoire (minimum 2 caractères)';
  }
  if (!professional_status || typeof professional_status !== 'string' || professional_status.trim().length < 2) {
    return 'Le statut professionnel est obligatoire';
  }
  if (!establishments || typeof establishments !== 'string' || establishments.trim().length < 2) {
    return 'L\'établissement est obligatoire';
  }

  if (!Array.isArray(days)) {
    return 'Les jours doivent être un tableau';
  }

  if (days.length === 0) {
    return 'Au moins un jour doit être renseigné';
  }

  for (const day of days) {
    if (typeof day.day_of_week !== 'number' || day.day_of_week < 0 || day.day_of_week > 4) {
      return 'Jour de la semaine invalide';
    }

    if (typeof day.has_courses !== 'boolean') {
      return 'Le champ "has_courses" doit être un booléen';
    }

    if (day.has_courses) {
      if (!Array.isArray(day.slots) || day.slots.length === 0) {
        return `Au moins un créneau est requis pour ${DAY_LABELS[day.day_of_week]}`;
      }

      const sortedSlots = [...day.slots].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

      for (let i = 0; i < sortedSlots.length; i++) {
        const slot = sortedSlots[i];

        if (!slot.start_time || !slot.end_time) {
          return `Heure manquante pour un créneau de ${DAY_LABELS[day.day_of_week]}`;
        }

        const start = timeToMinutes(slot.start_time);
        const end = timeToMinutes(slot.end_time);

        if (end <= start) {
          return `L'heure de fin doit être après l'heure de début pour un créneau de ${DAY_LABELS[day.day_of_week]}`;
        }

        if (!slot.class_name || typeof slot.class_name !== 'string' || slot.class_name.trim().length < 1) {
          return `La classe est obligatoire pour un créneau de ${DAY_LABELS[day.day_of_week]}`;
        }

        if (!slot.establishment || typeof slot.establishment !== 'string' || slot.establishment.trim().length < 1) {
          return `L'établissement est obligatoire pour un créneau de ${DAY_LABELS[day.day_of_week]}`;
        }

        if (i > 0) {
          const prevEnd = timeToMinutes(sortedSlots[i - 1].end_time);
          if (start < prevEnd) {
            return `Chevauchement détecté entre deux créneaux de ${DAY_LABELS[day.day_of_week]}`;
          }
        }
      }
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const validationError = validateSubmission(body);
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const rpcData = {
      last_name: body.last_name.trim(),
      first_names: body.first_names.trim(),
      professional_status: body.professional_status.trim(),
      establishments: body.establishments.trim(),
      days: body.days.map((d: any) => ({
        day_of_week: d.day_of_week,
        has_courses: d.has_courses,
        slots: d.has_courses ? d.slots.map((s: any) => ({
          start_time: s.start_time,
          end_time: s.end_time,
          class_name: s.class_name.trim(),
          establishment: s.establishment.trim(),
        })) : [],
      })),
    };

    const { data: teacherId, error } = await supabase
      .rpc('submit_teacher_schedule', { data: rpcData });

    if (error) {
      return NextResponse.json(
        { error: 'Erreur lors de l\'enregistrement: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, teacherId });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erreur serveur: ' + (err?.message || 'Erreur inconnue') },
      { status: 500 }
    );
  }
}
