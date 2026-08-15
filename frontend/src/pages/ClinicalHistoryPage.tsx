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

const entryTone: Record<ClinicalEntryType, 'danger' | 'info' | 'muted' | 'warn'> = {
  DIAGNOSIS: 'danger',
  PRESCRIPTION: 'info',
  NOTE: 'muted',
  ALLERGY_UPDATE: 'warn',
};

const emptyPatientForm = { mrn: '', fullName: '', dateOfBirth: '', sex: 'X' as PatientSex, allergies: '', notes: '' };
const emptyEntryForm = { entryType: 'NOTE' as ClinicalEntryType, title: '', description: '', relatedItemId: '' };

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

  const [creatingPatient, setCreatingPatient] = useState(false);
  const [patientForm, setPatientForm] = useState(emptyPatientForm);
  const [patientMsg, setPatientMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [entryForm, setEntryForm] = useState(emptyEntryForm);
  const [entryMsg, setEntryMsg] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const [versionsFor, setVersionsFor] = useState<string | null>(null);
  const [versions, setVersions] = useState<{ currentVersion: number; versions: ClinicalHistoryVersion[] } | null>(null);
  const [versionsLoading, setVersionsLoading] = useState(false);

  async function createPatient(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setPatientMsg(null);
    try {
      const res = await api.post<{ patient: Patient }>('/patients', patientForm);
      setPatientMsg('Paciente creado.');
      setPatientForm(emptyPatientForm);
      setCreatingPatient(false);
      patients.reload();
      setSelectedId(res.patient.id);
    } catch (err) {
      setPatientMsg(err instanceof ApiError ? err.message : 'Error al crear el paciente');
    } finally {
      setBusy(false);
    }
  }

  function startEntry(entry?: ClinicalHistoryEntry) {
    if (entry) {
      setEditingEntryId(entry.id);
      setEntryForm({
        entryType: entry.entryType,
        title: entry.title,
        description: entry.description,
        relatedItemId: entry.relatedItem?.id ?? '',
      });
    } else {
      setEditingEntryId('new');
      setEntryForm(emptyEntryForm);
    }
    setEntryMsg(null);
  }

  async function submitEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setEntryMsg(null);
    const body = {
      entryType: entryForm.entryType,
      title: entryForm.title,
      description: entryForm.description,
      relatedItemId: entryForm.relatedItemId || null,
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

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Historia Clínica</h1>
        <p className="page-sub">
          Registro de pacientes orientado a farmacia: prescripciones y notas asociadas a la
          dispensación, con versionado de cada cambio. No reemplaza al HIS del hospital.
        </p>
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
                  setCreatingPatient((v) => !v);
                  setPatientMsg(null);
                }}
              >
                {creatingPatient ? 'Cancelar' : 'Nuevo paciente'}
              </button>
            )}
          </div>

          {patientMsg && !creatingPatient && (
            <div className="muted" style={{ marginBottom: 12 }}>{patientMsg}</div>
          )}

          {creatingPatient && (
            <form className="card card-pad mt-16" onSubmit={createPatient} style={{ marginBottom: 16 }}>
              <div className="field">
                <label>Nº de historia clínica (MRN)</label>
                <input value={patientForm.mrn} onChange={(e) => setPatientForm({ ...patientForm, mrn: e.target.value })} required />
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
              <div className="field">
                <label>Alergias conocidas</label>
                <input value={patientForm.allergies} onChange={(e) => setPatientForm({ ...patientForm, allergies: e.target.value })} />
              </div>
              {patientMsg && <div className="muted" style={{ marginBottom: 10 }}>{patientMsg}</div>}
              <button className="btn btn-primary btn-sm" disabled={busy}>
                {busy ? 'Guardando…' : 'Crear paciente'}
              </button>
            </form>
          )}

          {patients.loading && <Loading />}
          {patients.error && <ErrorState message={patients.error} />}
          {patients.data && (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Paciente</th><th>MRN</th><th>Alergias</th></tr>
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
                      <td>{p.allergies ? <Badge tone="warn">{p.allergies}</Badge> : <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                  {patients.data.patients.length === 0 && (
                    <tr><td colSpan={3} className="muted" style={{ textAlign: 'center', padding: 24 }}>Sin pacientes.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          {!selectedId && <div className="card card-pad muted">Seleccioná un paciente para ver su historia clínica.</div>}
          {selectedId && detail.loading && <Loading />}
          {selectedId && patient && (
            <>
              <div className="card card-pad" style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{patient.fullName}</div>
                <div className="muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
                  MRN {patient.mrn} · {new Date(patient.dateOfBirth).toLocaleDateString('es')} · Sexo {patient.sex}
                </div>
                {patient.allergies && (
                  <div style={{ marginTop: 8 }}>
                    <Badge tone="warn">Alergias: {patient.allergies}</Badge>
                  </div>
                )}
              </div>

              {entryMsg && editingEntryId === null && (
                <div className="muted" style={{ marginBottom: 12 }}>{entryMsg}</div>
              )}

              <div className="row between" style={{ marginBottom: 12 }}>
                <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Entradas</h2>
                {canCreateEntry && editingEntryId === null && (
                  <button className="btn btn-primary btn-sm" onClick={() => startEntry()}>
                    Nueva entrada
                  </button>
                )}
              </div>

              {editingEntryId && (
                <form className="card card-pad" onSubmit={submitEntry} style={{ marginBottom: 16 }}>
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
                    <div className="field">
                      <label>Medicamento (opcional)</label>
                      <select value={entryForm.relatedItemId} onChange={(e) => setEntryForm({ ...entryForm, relatedItemId: e.target.value })}>
                        <option value="">Sin asociar</option>
                        {items.data?.items.map((i) => (
                          <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                      </select>
                    </div>
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

              {(patient.entries ?? []).map((entry) => (
                <div key={entry.id} className="card card-pad" style={{ marginBottom: 12 }}>
                  <div className="row between">
                    <div className="row" style={{ gap: 8 }}>
                      <Badge tone={entryTone[entry.entryType]}>{ENTRY_TYPE_LABELS[entry.entryType]}</Badge>
                      <span style={{ fontWeight: 600 }}>{entry.title}</span>
                    </div>
                    <span className="muted" style={{ fontSize: '0.78rem' }}>v{entry.version}</span>
                  </div>
                  <p style={{ margin: '8px 0' }}>{entry.description}</p>
                  {entry.relatedItem && (
                    <div className="muted" style={{ fontSize: '0.82rem' }}>Medicamento: {entry.relatedItem.name}</div>
                  )}
                  <div className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>
                    {entry.createdBy?.fullName ?? '—'} · {new Date(entry.createdAt).toLocaleString('es')}
                    {entry.updatedBy && ` · editado por ${entry.updatedBy.fullName}`}
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 10 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => viewVersions(entry.id)}>
                      {versionsFor === entry.id ? 'Ocultar versiones' : 'Ver versiones'}
                    </button>
                    {canUpdateEntry && (
                      <button className="btn btn-ghost btn-sm" onClick={() => startEntry(entry)}>
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
              {(patient.entries ?? []).length === 0 && (
                <div className="card card-pad muted">Sin entradas registradas todavía.</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
