'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Clock, CheckCircle2, AlertCircle, Loader2, GraduationCap, User, CalendarDays, ShieldCheck } from 'lucide-react';
import { DAYS, type ScheduleSlot } from '@/lib/types';

interface SlotState extends ScheduleSlot {
  id: string;
}

interface DayState {
  has_courses: boolean;
  slots: SlotState[];
}

const emptySlot = (): SlotState => ({
  id: Math.random().toString(36).substring(7),
  start_time: '08:00',
  end_time: '09:00',
  class_name: '',
  establishment: '',
});

const initialDays: DayState[] = DAYS.map(() => ({
  has_courses: true,
  slots: [emptySlot()],
}));

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export default function TeacherForm() {
  const [lastName, setLastName] = useState('');
  const [firstNames, setFirstNames] = useState('');
  const [professionalStatus, setProfessionalStatus] = useState('');
  const [establishments, setEstablishments] = useState('');
  const [days, setDays] = useState<DayState[]>(initialDays);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const updateSlot = (dayIdx: number, slotId: string, field: keyof SlotState, value: string) => {
    setDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      return {
        ...d,
        slots: d.slots.map(s => s.id === slotId ? { ...s, [field]: value } : s),
      };
    }));
  };

  const addSlot = (dayIdx: number) => {
    setDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      return { ...d, slots: [...d.slots, emptySlot()] };
    }));
  };

  const removeSlot = (dayIdx: number, slotId: string) => {
    setDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      return { ...d, slots: d.slots.filter(s => s.id !== slotId) };
    }));
  };

  const toggleDayCourses = (dayIdx: number, hasCourses: boolean) => {
    setDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      return {
        has_courses: hasCourses,
        slots: hasCourses ? (d.slots.length > 0 ? d.slots : [emptySlot()]) : [],
      };
    }));
  };

  const validateClient = (): string | null => {
    if (lastName.trim().length < 2) return 'Le nom est obligatoire (minimum 2 caractères)';
    if (firstNames.trim().length < 2) return 'Le prénom est obligatoire (minimum 2 caractères)';
    if (professionalStatus.trim().length < 2) return 'Le statut professionnel est obligatoire';
    if (establishments.trim().length < 2) return 'L\'établissement est obligatoire';

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      if (!day.has_courses) continue;

      if (day.slots.length === 0) return `Au moins un créneau est requis pour ${DAYS[i].label}`;

      const sorted = [...day.slots].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

      for (let j = 0; j < sorted.length; j++) {
        const s = sorted[j];
        const start = timeToMinutes(s.start_time);
        const end = timeToMinutes(s.end_time);

        if (end <= start) return `L'heure de fin doit être après l'heure de début pour un créneau de ${DAYS[i].label}`;
        if (!s.class_name.trim()) return `La classe est obligatoire pour un créneau de ${DAYS[i].label}`;
        if (!s.establishment.trim()) return `L'établissement est obligatoire pour un créneau de ${DAYS[i].label}`;

        if (j > 0) {
          const prevEnd = timeToMinutes(sorted[j - 1].end_time);
          if (start < prevEnd) return `Chevauchement détecté entre deux créneaux de ${DAYS[i].label}`;
        }
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        last_name: lastName.trim(),
        first_names: firstNames.trim(),
        professional_status: professionalStatus.trim(),
        establishments: establishments.trim(),
        days: days.map((d, i) => ({
          day_of_week: i,
          has_courses: d.has_courses,
          slots: d.has_courses ? d.slots.map(s => ({
            start_time: s.start_time,
            end_time: s.end_time,
            class_name: s.class_name.trim(),
            establishment: s.establishment.trim(),
          })) : [],
        })),
      };

      const res = await fetch('/api/submit-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erreur lors de l\'envoi');
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError('Erreur réseau: ' + (err?.message || 'Impossible d\'envoyer le formulaire'));
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setLastName('');
    setFirstNames('');
    setProfessionalStatus('');
    setEstablishments('');
    setDays(initialDays);
    setError(null);
    setSuccess(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg shadow-lg">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Enregistrement réussi</h2>
            <p className="text-slate-600">
              Votre emploi du temps a été enregistré avec succès. Merci pour votre contribution.
            </p>
            <Button onClick={resetForm} className="mt-4" size="lg">
              Soumettre un nouvel emploi du temps
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="schedule-page min-h-screen px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
    <div className="mx-auto max-w-3xl">
      <header className="schedule-hero mb-8 rounded-[2rem] px-6 py-8 text-white shadow-2xl shadow-slate-900/10 sm:px-10 sm:py-10">
        <div className="relative z-10">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-inner shadow-white/10">
              <GraduationCap className="h-6 w-6 text-blue-100" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
                Portail enseignant
              </p>
              <p className="mt-0.5 text-xs text-slate-300">Organisation pédagogique</p>
            </div>
          </div>
          <div className="max-w-xl">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Votre semaine de cours,
              <span className="block text-blue-200">en toute simplicité.</span>
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300 sm:text-base">
              Partagez vos disponibilités et vos créneaux pour préparer votre emploi du temps.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3.5 py-2 text-sm text-slate-100">
              <CalendarDays className="h-4 w-4 text-blue-200" />
              Du lundi au vendredi
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3.5 py-2 text-sm text-slate-100">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              Informations protégées
            </div>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Teacher info */}
        <Card className="rounded-2xl border-white/80 bg-white/95 shadow-xl shadow-slate-200/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                <User className="h-4 w-4 text-blue-700" />
              </span>
              Informations personnelles
            </CardTitle>
            <CardDescription>Vos coordonnées et statut professionnel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nom <span className="text-red-500">*</span></Label>
                  <Input
                    id="last_name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Dupont"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="first_names">Prénom(s) <span className="text-red-500">*</span></Label>
                  <Input
                    id="first_names"
                    value={firstNames}
                    onChange={(e) => setFirstNames(e.target.value)}
                    placeholder="Jean Marie"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="professional_status">Statut professionnel <span className="text-red-500">*</span></Label>
                <Input
                  id="professional_status"
                  value={professionalStatus}
                  onChange={(e) => setProfessionalStatus(e.target.value)}
                  placeholder="Titulaire, vacataire, contractuel..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="establishments">Établissement(s) <span className="text-red-500">*</span></Label>
                <Input
                  id="establishments"
                  value={establishments}
                  onChange={(e) => setEstablishments(e.target.value)}
                  placeholder="Lycée Victor Hugo, Collège Jean Jaurès..."
                  required
                />
                <p className="text-xs text-slate-500">
                  Séparez plusieurs établissements par une virgule.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Days */}
          {DAYS.map((day, dayIdx) => (
            <Card key={day.value} className="rounded-2xl border-white/80 bg-white/95 shadow-lg shadow-slate-200/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
                        <Clock className="h-4 w-4 text-indigo-700" />
                      </span>
                      {day.label}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {days[dayIdx].has_courses
                        ? `${days[dayIdx].slots.length} créneau(x) prévu(s)`
                        : 'Pas de cours'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-600">
                      {days[dayIdx].has_courses ? 'Cours' : 'Pas de cours'}
                    </span>
                    <Switch
                      checked={days[dayIdx].has_courses}
                      onCheckedChange={(checked) => toggleDayCourses(dayIdx, checked)}
                    />
                  </div>
                </div>
              </CardHeader>

              {days[dayIdx].has_courses && (
                <CardContent className="space-y-3">
                  {days[dayIdx].slots.map((slot, slotIdx) => (
                    <div key={slot.id} className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 sm:p-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">
                          Créneau {slotIdx + 1}
                        </Badge>
                        {days[dayIdx].slots.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSlot(dayIdx, slot.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Supprimer
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor={`start-${dayIdx}-${slot.id}`} className="text-xs">
                            Heure de début <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id={`start-${dayIdx}-${slot.id}`}
                            type="time"
                            step={300}
                            value={slot.start_time}
                            onChange={(e) => updateSlot(dayIdx, slot.id, 'start_time', e.target.value)}
                            className="bg-white"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`end-${dayIdx}-${slot.id}`} className="text-xs">
                            Heure de fin <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id={`end-${dayIdx}-${slot.id}`}
                            type="time"
                            step={300}
                            value={slot.end_time}
                            onChange={(e) => updateSlot(dayIdx, slot.id, 'end_time', e.target.value)}
                            className="bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor={`class-${dayIdx}-${slot.id}`} className="text-xs">
                            Classe <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id={`class-${dayIdx}-${slot.id}`}
                            value={slot.class_name}
                            onChange={(e) => updateSlot(dayIdx, slot.id, 'class_name', e.target.value)}
                            placeholder="6ème A, Terminale S..."
                            className="bg-white"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`est-${dayIdx}-${slot.id}`} className="text-xs">
                            Établissement <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id={`est-${dayIdx}-${slot.id}`}
                            value={slot.establishment}
                            onChange={(e) => updateSlot(dayIdx, slot.id, 'establishment', e.target.value)}
                            placeholder="Lycée Victor Hugo..."
                            className="bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addSlot(dayIdx)}
                    className="w-full border-dashed"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un créneau
                  </Button>
                </CardContent>
              )}
            </Card>
          ))}

          {error && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-2 pb-8">
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              size="lg"
              disabled={submitting}
            >
              Réinitialiser
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                'Envoyer'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
