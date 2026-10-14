'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, Download, LogOut, Loader2, Eye, ChevronLeft } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { DAYS, type Teacher, type ScheduleSlotRow } from '@/lib/types';

interface FlatRow {
  teacher_id: string;
  last_name: string;
  first_names: string;
  professional_status: string;
  establishments: string;
  day_of_week: number;
  day_label: string;
  has_courses: boolean;
  start_time: string | null;
  end_time: string | null;
  class_name: string | null;
  establishment: string | null;
}

interface TeacherDetail extends Teacher {
  days: {
    day_of_week: number;
    has_courses: boolean;
    slots: ScheduleSlotRow[];
  }[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allRows, setAllRows] = useState<FlatRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [establishmentFilter, setEstablishmentFilter] = useState('all');
  const [dayFilter, setDayFilter] = useState('all');
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = createBrowserClient();
    const { data: teachersData, error: teachersError } = await supabase
      .from('teachers')
      .select('*')
      .order('created_at', { ascending: false });

    if (teachersError || !teachersData) {
      if (teachersError?.message?.includes('JWT') || teachersError?.code === 'PGRST301') {
        router.replace('/admin');
        return;
      }
      setLoading(false);
      return;
    }

    setTeachers(teachersData as Teacher[]);

    const { data: daysData } = await supabase
      .from('schedule_days')
      .select('id, teacher_id, day_of_week, has_courses');

    const { data: slotsData } = await supabase
      .from('schedule_slots')
      .select('id, day_id, start_time, end_time, class_name, establishment');

    const rows: FlatRow[] = [];

    for (const teacher of teachersData as Teacher[]) {
      const teacherDays = (daysData || []).filter((d: any) => d.teacher_id === teacher.id);
      for (const day of teacherDays) {
        const daySlots = (slotsData || []).filter((s: any) => s.day_id === day.id);
        if (day.has_courses && daySlots.length > 0) {
          for (const slot of daySlots) {
            rows.push({
              teacher_id: teacher.id,
              last_name: teacher.last_name,
              first_names: teacher.first_names,
              professional_status: teacher.professional_status,
              establishments: teacher.establishments,
              day_of_week: day.day_of_week,
              day_label: DAYS[day.day_of_week].label,
              has_courses: true,
              start_time: slot.start_time,
              end_time: slot.end_time,
              class_name: slot.class_name,
              establishment: slot.establishment,
            });
          }
        } else {
          rows.push({
            teacher_id: teacher.id,
            last_name: teacher.last_name,
            first_names: teacher.first_names,
            professional_status: teacher.professional_status,
            establishments: teacher.establishments,
            day_of_week: day.day_of_week,
            day_label: DAYS[day.day_of_week].label,
            has_courses: false,
            start_time: null,
            end_time: null,
            class_name: null,
            establishment: null,
          });
        }
      }
    }

    setAllRows(rows);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/admin');
      } else {
        loadData();
      }
    });
  }, [router, loadData]);

  const handleLogout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.replace('/admin');
  };

  const establishmentOptions = useMemo(() => {
    const set = new Set<string>();
    teachers.forEach(t => {
      t.establishments.split(',').forEach(e => {
        const trimmed = e.trim();
        if (trimmed) set.add(trimmed);
      });
    });
    return Array.from(set).sort();
  }, [teachers]);

  const filteredRows = useMemo(() => {
    return allRows.filter(row => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const fullName = `${row.last_name} ${row.first_names}`.toLowerCase();
        if (!fullName.includes(q)) return false;
      }

      if (establishmentFilter !== 'all') {
        if (!row.establishments.toLowerCase().includes(establishmentFilter.toLowerCase()) &&
            row.establishment?.toLowerCase() !== establishmentFilter.toLowerCase()) {
          return false;
        }
      }

      if (dayFilter !== 'all') {
        if (row.day_of_week !== parseInt(dayFilter)) return false;
      }

      return true;
    });
  }, [allRows, searchQuery, establishmentFilter, dayFilter]);

  const exportCSV = () => {
    const headers = ['Nom', 'Prénom(s)', 'Statut', 'Établissement', 'Jour', 'Heure de début', 'Heure de fin', 'Classe'];
    const csvRows = filteredRows.map(r => [
      r.last_name,
      r.first_names,
      r.professional_status,
      r.establishments,
      r.day_label,
      r.has_courses ? r.start_time : 'Pas de cours',
      r.has_courses ? r.end_time : '',
      r.has_courses ? r.class_name : '',
    ]);

    const csv = [
      headers.join(';'),
      ...csvRows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(';')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `emplois-du-temps-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const viewTeacherDetail = async (teacherId: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    const supabase = createBrowserClient();

    const { data: teacher } = await supabase
      .from('teachers')
      .select('*')
      .eq('id', teacherId)
      .single();

    if (!teacher) {
      setDetailLoading(false);
      return;
    }

    const { data: days } = await supabase
      .from('schedule_days')
      .select('day_of_week, has_courses')
      .eq('teacher_id', teacherId)
      .order('day_of_week', { ascending: true });

    const dayIds: Record<number, boolean> = {};
    (days || []).forEach((d: any) => {
      dayIds[d.day_of_week] = d.has_courses;
    });

    const detail: TeacherDetail = {
      ...teacher,
      days: DAYS.map(d => ({
        day_of_week: d.value,
        has_courses: dayIds[d.value] ?? false,
        slots: [],
      })),
    };

    for (const d of detail.days) {
      if (!d.has_courses) continue;
      const { data: dayRow } = await supabase
        .from('schedule_days')
        .select('id')
        .eq('teacher_id', teacherId)
        .eq('day_of_week', d.day_of_week)
        .single();

      if (dayRow) {
        const { data: slots } = await supabase
          .from('schedule_slots')
          .select('start_time, end_time, class_name, establishment')
          .eq('day_id', dayRow.id)
          .order('start_time', { ascending: true });
        d.slots = (slots || []) as ScheduleSlotRow[];
      }
    }

    setSelectedTeacher(detail);
    setDetailLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Tableau de bord — Administrateur</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <p className="text-sm text-slate-500">Enseignants</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{teachers.length}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <p className="text-sm text-slate-500">Créneaux totaux</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {allRows.filter(r => r.has_courses).length}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <p className="text-sm text-slate-500">Résultats filtrés</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{filteredRows.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="shadow-sm mb-6">
          <CardContent className="pt-5 pb-5">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Recherche par nom</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nom de l'enseignant..."
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Établissement</Label>
                <Select value={establishmentFilter} onValueChange={setEstablishmentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les établissements</SelectItem>
                    {establishmentOptions.map(est => (
                      <SelectItem key={est} value={est}>{est}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Jour</Label>
                <Select value={dayFilter} onValueChange={setDayFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les jours</SelectItem>
                    {DAYS.map(d => (
                      <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={exportCSV} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exporter en CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Réponses des enseignants</CardTitle>
            <CardDescription>
              Une ligne par créneau. Les informations de l'enseignant sont répétées sur chaque ligne.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Nom</TableHead>
                    <TableHead className="font-semibold">Prénom(s)</TableHead>
                    <TableHead className="font-semibold hidden md:table-cell">Statut</TableHead>
                    <TableHead className="font-semibold hidden lg:table-cell">Établissement</TableHead>
                    <TableHead className="font-semibold">Jour</TableHead>
                    <TableHead className="font-semibold">Heure début</TableHead>
                    <TableHead className="font-semibold">Heure fin</TableHead>
                    <TableHead className="font-semibold hidden sm:table-cell">Classe</TableHead>
                    <TableHead className="font-semibold text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                        Aucun résultat trouvé.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((row, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50">
                        <TableCell className="font-medium">{row.last_name}</TableCell>
                        <TableCell>{row.first_names}</TableCell>
                        <TableCell className="hidden md:table-cell">{row.professional_status}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-slate-600">{row.establishments}</TableCell>
                        <TableCell>
                          <Badge variant={row.has_courses ? 'default' : 'secondary'} className="font-normal">
                            {row.day_label}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.has_courses ? row.start_time : <span className="text-slate-400 italic">—</span>}</TableCell>
                        <TableCell>{row.has_courses ? row.end_time : <span className="text-slate-400 italic">—</span>}</TableCell>
                        <TableCell className="hidden sm:table-cell">{row.has_courses ? row.class_name : <span className="text-slate-400 italic">—</span>}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => viewTeacherDetail(row.teacher_id)}
                            className="h-8"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            <span className="hidden sm:inline">Détails</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Teacher detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : selectedTeacher ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {selectedTeacher.last_name} {selectedTeacher.first_names}
                </DialogTitle>
                <DialogDescription>
                  {selectedTeacher.professional_status} — {selectedTeacher.establishments}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {selectedTeacher.days.map((day, idx) => (
                  <div key={idx}>
                    {idx > 0 && <Separator className="mb-4" />}
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-slate-800">{DAYS[day.day_of_week].label}</h4>
                      {!day.has_courses && (
                        <Badge variant="secondary">Pas de cours</Badge>
                      )}
                    </div>
                    {day.has_courses && day.slots.length > 0 ? (
                      <div className="space-y-2">
                        {day.slots.map((slot, sIdx) => (
                          <div key={sIdx} className="flex items-center gap-3 rounded-lg border bg-slate-50 p-3 text-sm">
                            <span className="font-mono font-medium text-slate-700">
                              {slot.start_time} — {slot.end_time}
                            </span>
                            <span className="text-slate-600">{slot.class_name}</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-500 text-xs">{slot.establishment}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
