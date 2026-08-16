import { useState } from 'react';
import { useApi } from '../api/useApi';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { P } from '../rbac/permissions';
import { Badge, ErrorState, Loading } from '../components/ui';
import type {
  ClinicalEntryType,
  ClinicalHistoryEntry,
  ClinicalHistoryVersion,
  InventoryItem,
  Patient,
  PatientSex,
} from '../api/types';

const ENTRY_TYPE_LABELS: Record<ClinicalEntryType, string> = {
  DIAGNOSIS: 'Diagnóstico',
  PRESCRIPTION: 'Prescripción',
  NOTE: 'Nota clínica',
  ALLERGY_UPDATE: 'Actualización de alergias',
};

const emptyPatientForm = {
  mrn: '',
  fullName: '',
  dateOfBirth: '',
  sex: 'X' as PatientSex,
  weightKg: '',
  heightM: '',
  allergies: '',
  notes: '',
};
const emptyEntryForm = {
  entryType: 'NOTE' as ClinicalEntryType,
  title: '',
  description: '',
  relatedItemId: '',
  dose: '',
  frequency: '',
  startDate: '',
};

function computeAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

function timeSince(isoDate: string): string {
  const start = new Date(isoDate);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (months < 1) return 'este mes';
  if (months < 12) return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
  const years = Math.floor(months / 12);
  return `hace ${years} ${years === 1 ? 'año' : 'años'}`;
}

export function ClinicalHistoryPage() {
  const { can } = useAuth();
  const canManagePatients = can(P.PATIENTS_MANAGE);
  const canCreateEntry = can(P.CLINICAL_HISTORY_CREATE);
  const canUpdateEntry = can(P.CLINICAL_HISTORY_UPDATE);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const patients = useApi<{ patients: Patient[] }>(
    debouncedSearch ? `/patients?q=${encodeURIComponent(debouncedSearch)}` : '/patients'
  );
  const items = useApi<{ items: InventoryItem[] }>('/inventory');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useApi<{ patient: Patient }>(selectedId ? `/patients/${selectedId}` : '/patients');

  const [patientFormMode, setPatientFormMode] = useState<'create' | 'edit' | null>(null);
  const [patientForm, setPatientForm] = useState(emptyPatientForm);
  const [patientMsg, setPatientMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [entryForm, setEntryForm] = useState(emptyEntryForm);
  const [entryMsg, setEntryMsg] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const [versionsFor, setVersionsFor] = useState<string | null>(null);
  const [versions, setVersions] = useState<{ currentVersion: number; versions: ClinicalHistoryVersion[] } | null>(null);
  const [versionsLoading, setVersionsLoading] = useState(false);

  function startCreatePatient() {
    setPatientFormMode('create');
    setPatientForm(emptyPatientForm);
    setPatientMsg(null);
  }

  function startEditPatient(p: Patient) {
    setPatientFormMode('edit');
    setPatientForm({
      mrn: p.mrn,
      fullName: p.fullName,
      dateOfBirth: p.dateOfBirth.slice(0, 10),
      sex: p.sex,
      weightKg: p.weightKg?.toString() ?? '',
      heightM: p.heightM?.toString() ?? '',
      allergies: p.allergies ?? '',
      notes: p.notes ?? '',
    });
    setPatientMsg(null);
  }

  async function submitPatient(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setPatientMsg(null);
    const body = {
      mrn: patientForm.mrn,
      fullName: patientForm.fullName,
      dateOfBirth: patientForm.dateOfBirth,
      sex: patientForm.sex,
      weightKg: patientForm.weightKg ? Number(patientForm.weightKg) : null,
      heightM: patientForm.heightM ? Number(patientForm.heightM) : null,
      allergies: patientForm.allergies,
      notes: patientForm.notes,
    };
    try {
      if (patientFormMode === 'create') {
        const res = await api.post<{ patient: Patient }>('/patients', body);
        setPatientMsg('Paciente creado.');
        patients.reload();
        setSelectedId(res.patient.id);
      } else if (patientFormMode === 'edit' && selectedId) {
        await api.patch(`/patients/${selectedId}`, body);
        setPatientMsg('Datos del paciente actualizados.');
        patients.reload();
        detail.reload();
      }
      setPatientFormMode(null);
    } catch (err) {
      setPatientMsg(err instanceof ApiError ? err.message : 'Error al guardar el paciente');
    } finally {
      setBusy(false);
    }
  }

  function startEntry(entry?: ClinicalHistoryEntry, defaultType?: ClinicalEntryType) {
    if (entry) {
      setEditingEntryId(entry.id);
      setEntryForm({
        entryType: entry.entryType,
        title: entry.title,
        description: entry.description,
        relatedItemId: entry.relatedItem?.id ?? '',
        dose: entry.dose ?? '',
        frequency: entry.frequency ?? '',
        startDate: entry.startDate?.slice(0, 10) ?? '',
      });
    } else {
      setEditingEntryId('new');
      setEntryForm({ ...emptyEntryForm, entryType: defaultType ?? 'NOTE' });
    }
    setEntryMsg(null);
  }

  async function submitEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setEntryMsg(null);
    const isPrescription = entryForm.entryType === 'PRESCRIPTION';
    const body = {
      entryType: entryForm.entryType,
      title: entryForm.title,
      description: entryForm.description,
      relatedItemId: isPrescription ? entryForm.relatedItemId || null : null,
      dose: isPrescription ? entryForm.dose || null : null,
      frequency: isPrescription ? entryForm.frequency || null : null,
      startDate: isPrescription ? entryForm.startDate || null : null,
    };
    try {
      if (editingEntryId === 'new') {
        await api.post(`/patients/${selectedId}/entries`, body);
        setEntryMsg('Entrada registrada.');
      } else if (editingEntryId) {
        await api.patch(`/patients/entries/${editingEntryId}`, body);
        setEntryMsg('Entrada actualizada (versión anterior archivada).');
      }
      setEditingEntryId(null);
      detail.reload();
    } catch (err) {
      setEntryMsg(err instanceof ApiError ? err.message : 'Error al guardar la entrada');
    } finally {
      setBusy(false);
    }
  }

  async function viewVersions(entryId: string) {
    if (versionsFor === entryId) {
      setVersionsFor(null);
      setVersions(null);
      return;
    }
    setVersionsFor(entryId);
    setVersions(null);
    setVersionsLoading(true);
    try {
      const res = await api.get<{ currentVersion: number; versions: ClinicalHistoryVersion[] }>(
        `/patients/entries/${entryId}/versions`
      );
      setVersions(res);
    } finally {
      setVersionsLoading(false);
    }
  }

  const patient = detail.data?.patient;
  const entries = patient?.entries ?? [];
  const prescriptions = entries.filter((e) => e.entryType === 'PRESCRIPTION');
  const diagnoses = entries.filter((e) => e.entryType === 'DIAGNOSIS');
  const background = entries.filter((e) => e.entryType === 'NOTE' || e.entryType === 'ALLERGY_UPDATE');

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Historia Clínica</h1>
      </div>

      <div className="grid-2">
        <div>
          <div className="row wrap" style={{ marginBottom: 12, gap: 12 }}>
            <input
              style={{ maxWidth: 280 }}
              placeholder="Buscar por nombre o Nº de historia clínica…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {canManagePatients && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  if (patientFormMode) {
                    setPatientFormMode(null);
                  } else {
                    startCreatePatient();
                  }
                }}
              >
                {patientFormMode ? 'Cancelar' : 'Nuevo paciente'}
              </button>
            )}
          </div>

          {patientMsg && !patientFormMode && (
            <div className="muted" style={{ marginBottom: 12 }}>{patientMsg}</div>
          )}

          {patientFormMode && (
            <form className="card card-pad mt-16" onSubmit={submitPatient} style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: '1rem', marginTop: 0 }}>
                {patientFormMode === 'create' ? 'Nuevo paciente' : 'Editar datos del paciente'}
              </h2>
              <div className="field">
                <label>Nº de historia clínica (MRN)</label>
                <input
                  value={patientForm.mrn}
                  onChange={(e) => setPatientForm({ ...patientForm, mrn: e.target.value })}
                  disabled={patientFormMode === 'edit'}
                  required
                />
              </div>
              <div className="field">
                <label>Nombre completo</label>
                <input value={patientForm.fullName} onChange={(e) => setPatientForm({ ...patientForm, fullName: e.target.value })} required />
              </div>
              <div className="row" style={{ gap: 12 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Fecha de nacimiento</label>
                  <input type="date" value={patientForm.dateOfBirth} onChange={(e) => setPatientForm({ ...patientForm, dateOfBirth: e.target.value })} required />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Sexo</label>
                  <select value={patientForm.sex} onChange={(e) => setPatientForm({ ...patientForm, sex: e.target.value as PatientSex })}>
                    <option value="F">F</option>
                    <option value="M">M</option>
                    <option value="X">X</option>
                  </select>
                </div>
              </div>
              <div className="row" style={{ gap: 12 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Peso (kg)</label>
                  <input type="number" min={0} step={0.1} value={patientForm.weightKg} onChange={(e) => setPatientForm({ ...patientForm, weightKg: e.target.value })} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Altura (m)</label>
                  <input type="number" min={0} step={0.01} value={patientForm.heightM} onChange={(e) => setPatientForm({ ...patientForm, heightM: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label>Alergias conocidas</label>
                <input value={patientForm.allergies} onChange={(e) => setPatientForm({ ...patientForm, allergies: e.target.value })} />
              </div>
              <div className="field">
                <label>Observaciones clínicas importantes</label>
                <textarea value={patientForm.notes} onChange={(e) => setPatientForm({ ...patientForm, notes: e.target.value })} />
              </div>
              {patientMsg && <div className="muted" style={{ marginBottom: 10 }}>{patientMsg}</div>}
              <button className="btn btn-primary btn-sm" disabled={busy}>
                {busy ? 'Guardando…' : patientFormMode === 'create' ? 'Crear paciente' : 'Guardar cambios'}
              </button>
            </form>
          )}

          {patients.loading && <Loading />}
          {patients.error && <ErrorState message={patients.error} />}
          {patients.data && (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Paciente</th><th>MRN</th></tr>
                </thead>
                <tbody>
                  {patients.data.patients.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      style={{ cursor: 'pointer', background: selectedId === p.id ? 'var(--surface-2)' : undefined }}
                    >
                      <td style={{ fontWeight: 600 }}>{p.fullName}</td>
                      <td className="mono muted">{p.mrn}</td>
                    </tr>
                  ))}
                  {patients.data.patients.length === 0 && (
                    <tr><td colSpan={2} className="muted" style={{ textAlign: 'center', padding: 24 }}>Sin pacientes.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          {!selectedId && <div className="card card-pad muted">Seleccioná un paciente para ver su ficha clínica.</div>}
          {selectedId && detail.loading && <Loading />}
          {selectedId && patient && (
            <>
              <div className="card card-pad" style={{ marginBottom: 16 }}>
                <div className="row between">
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Historia Clínica — {patient.fullName}</div>
                    <div className="muted mono" style={{ fontSize: '0.85rem', marginTop: 2 }}>MRN: {patient.mrn}</div>
                  </div>
                  {canManagePatients && (
                    <button className="btn btn-ghost btn-sm" onClick={() => startEditPatient(patient)}>
                      Editar datos
                    </button>
                  )}
                </div>
                <div className="row wrap" style={{ gap: 18, marginTop: 12 }}>
                  <span className="muted">Edad: <strong style={{ color: 'var(--text)' }}>{computeAge(patient.dateOfBirth)} años</strong></span>
                  <span className="muted">Sexo: <strong style={{ color: 'var(--text)' }}>{patient.sex}</strong></span>
                  <span className="muted">Peso: <strong style={{ color: 'var(--text)' }}>{patient.weightKg ? `${patient.weightKg} kg` : '—'}</strong></span>
                  <span className="muted">Altura: <strong style={{ color: 'var(--text)' }}>{patient.heightM ? `${patient.heightM} m` : '—'}</strong></span>
                </div>
                <div className="mt-16" style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div className="muted" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                    Alergias
                  </div>
                  {patient.allergies ? <Badge tone="warn">{patient.allergies}</Badge> : <span className="muted">Sin alergias registradas.</span>}
                </div>
                <div className="mt-16" style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div className="muted" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                    Observaciones clínicas importantes
                  </div>
                  <span>{patient.notes || <span className="muted">Sin observaciones.</span>}</span>
                </div>
              </div>

              {patientFormMode === 'edit' && (
                <div className="muted" style={{ marginBottom: 12 }}>Editando datos del paciente en la columna de la izquierda…</div>
              )}

              {entryMsg && editingEntryId === null && (
                <div className="muted" style={{ marginBottom: 12 }}>{entryMsg}</div>
              )}

              <ClinicalSection
                title="Problemas de salud"
                emptyLabel="Sin diagnósticos registrados."
                entries={diagnoses}
                canCreate={canCreateEntry}
                canUpdate={canUpdateEntry}
                onAdd={() => startEntry(undefined, 'DIAGNOSIS')}
                onEdit={startEntry}
                onViewVersions={viewVersions}
                versionsFor={versionsFor}
                versions={versions}
                versionsLoading={versionsLoading}
                renderItem={(entry) => <p style={{ margin: '4px 0 0' }}>{entry.description}</p>}
              />

              <ClinicalSection
                title="Medicamentos actuales"
                emptyLabel="Sin medicación registrada."
                entries={prescriptions}
                canCreate={canCreateEntry}
                canUpdate={canUpdateEntry}
                onAdd={() => startEntry(undefined, 'PRESCRIPTION')}
                onEdit={startEntry}
                onViewVersions={viewVersions}
                versionsFor={versionsFor}
                versions={versions}
                versionsLoading={versionsLoading}
                renderItem={(entry) => (
                  <div style={{ marginTop: 4 }}>
                    <div className="muted" style={{ fontSize: '0.85rem' }}>
                      {[entry.dose, entry.frequency].filter(Boolean).join(' · ') || entry.description}
                      {entry.startDate && ` · ${timeSince(entry.startDate)}`}
                    </div>
                    {entry.dose && <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>{entry.description}</p>}
                  </div>
                )}
              />

              <ClinicalSection
                title="Antecedentes médicos relevantes"
                emptyLabel="Sin antecedentes registrados."
                entries={background}
                canCreate={canCreateEntry}
                canUpdate={canUpdateEntry}
                onAdd={() => startEntry(undefined, 'NOTE')}
                onEdit={startEntry}
                onViewVersions={viewVersions}
                versionsFor={versionsFor}
                versions={versions}
                versionsLoading={versionsLoading}
                renderItem={(entry) => <p style={{ margin: '4px 0 0' }}>{entry.description}</p>}
              />

              {editingEntryId && (
                <form className="card card-pad" onSubmit={submitEntry} style={{ marginTop: 16 }}>
                  <h2 style={{ fontSize: '1rem', marginTop: 0 }}>
                    {editingEntryId === 'new' ? 'Nueva entrada' : 'Editar entrada'}
                  </h2>
                  <div className="field">
                    <label>Tipo</label>
                    <select
                      value={entryForm.entryType}
                      onChange={(e) => setEntryForm({ ...entryForm, entryType: e.target.value as ClinicalEntryType })}
                    >
                      {Object.entries(ENTRY_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Título</label>
                    <input value={entryForm.title} onChange={(e) => setEntryForm({ ...entryForm, title: e.target.value })} required />
                  </div>
                  <div className="field">
                    <label>Descripción</label>
                    <textarea value={entryForm.description} onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })} required />
                  </div>
                  {entryForm.entryType === 'PRESCRIPTION' && (
                    <>
                      <div className="field">
                        <label>Medicamento (opcional)</label>
                        <select value={entryForm.relatedItemId} onChange={(e) => setEntryForm({ ...entryForm, relatedItemId: e.target.value })}>
                          <option value="">Sin asociar</option>
                          {items.data?.items.map((i) => (
                            <option key={i.id} value={i.id}>{i.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="row" style={{ gap: 12 }}>
                        <div className="field" style={{ flex: 1 }}>
                          <label>Dosis</label>
                          <input placeholder="p.ej. 50 mg" value={entryForm.dose} onChange={(e) => setEntryForm({ ...entryForm, dose: e.target.value })} />
                        </div>
                        <div className="field" style={{ flex: 1 }}>
                          <label>Frecuencia</label>
                          <input placeholder="p.ej. 1 vez al día" value={entryForm.frequency} onChange={(e) => setEntryForm({ ...entryForm, frequency: e.target.value })} />
                        </div>
                        <div className="field" style={{ flex: 1 }}>
                          <label>Desde</label>
                          <input type="date" value={entryForm.startDate} onChange={(e) => setEntryForm({ ...entryForm, startDate: e.target.value })} />
                        </div>
                      </div>
                    </>
                  )}
                  {entryMsg && <div className="muted" style={{ marginBottom: 10 }}>{entryMsg}</div>}
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn btn-primary btn-sm" disabled={busy}>
                      {busy ? 'Guardando…' : editingEntryId === 'new' ? 'Registrar entrada' : 'Guardar cambios'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingEntryId(null)}>
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface ClinicalSectionProps {
  title: string;
  emptyLabel: string;
  entries: ClinicalHistoryEntry[];
  canCreate: boolean;
  canUpdate: boolean;
  onAdd: () => void;
  onEdit: (entry: ClinicalHistoryEntry) => void;
  onViewVersions: (entryId: string) => void;
  versionsFor: string | null;
  versions: { currentVersion: number; versions: ClinicalHistoryVersion[] } | null;
  versionsLoading: boolean;
  renderItem: (entry: ClinicalHistoryEntry) => React.ReactNode;
}

function ClinicalSection({
  title,
  emptyLabel,
  entries,
  canCreate,
  canUpdate,
  onAdd,
  onEdit,
  onViewVersions,
  versionsFor,
  versions,
  versionsLoading,
  renderItem,
}: ClinicalSectionProps) {
  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: '1rem', margin: 0 }}>{title}</h2>
        {canCreate && (
          <button className="btn btn-ghost btn-sm" onClick={onAdd}>
            Agregar
          </button>
        )}
      </div>
      {entries.length === 0 && <div className="muted" style={{ fontSize: '0.85rem' }}>{emptyLabel}</div>}
      {entries.map((entry, i) => (
        <div key={entry.id} style={{ paddingTop: i > 0 ? 12 : 0, marginTop: i > 0 ? 12 : 0, borderTop: i > 0 ? '1px solid var(--border)' : undefined }}>
          <div className="row between">
            <strong>{entry.title}</strong>
            <span className="muted" style={{ fontSize: '0.76rem' }}>v{entry.version}</span>
          </div>
          {renderItem(entry)}
          <div className="muted" style={{ fontSize: '0.76rem', marginTop: 6 }}>
            {entry.createdBy?.fullName ?? '—'} · {new Date(entry.createdAt).toLocaleDateString('es')}
            {entry.updatedBy && ` · editado por ${entry.updatedBy.fullName}`}
          </div>
          <div className="row" style={{ gap: 6, marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => onViewVersions(entry.id)}>
              {versionsFor === entry.id ? 'Ocultar versiones' : 'Ver versiones'}
            </button>
            {canUpdate && (
              <button className="btn btn-ghost btn-sm" onClick={() => onEdit(entry)}>
                Editar
              </button>
            )}
          </div>
          {versionsFor === entry.id && (
            <div className="mt-16" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              {versionsLoading && <Loading label="Cargando versiones…" />}
              {versions && versions.versions.length === 0 && (
                <div className="muted" style={{ fontSize: '0.82rem' }}>Sin ediciones previas (versión actual: v{versions.currentVersion}).</div>
              )}
              {versions?.versions.map((v) => (
                <div key={v.id} className="muted" style={{ fontSize: '0.82rem', marginBottom: 8 }}>
                  <strong style={{ color: 'var(--text)' }}>v{v.version}</strong> · {v.title} —{' '}
                  {v.changedBy.fullName}, {new Date(v.changedAt).toLocaleString('es')}
                  <div>{v.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
