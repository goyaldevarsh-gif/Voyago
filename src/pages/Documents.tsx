import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Chip, EmptyState, Field, Input, Select, Sheet, TopBar, Textarea, useUi } from '../components/ui';
import { Icon } from '../components/icons';
import { useDocuments, useTrip } from '../hooks/data';
import { addDocument, documentUrl, removeRow, restoreRow, uploadPendingDocuments } from '../db/modules';
import type { TripDocument } from '../types';

const KINDS = ['ID proof', 'Ticket', 'Hotel / BnB', 'Insurance', 'Visa / Permit', 'Prescription', 'Course / Event', 'Other'];
const size = (n: number | null) => (n == null ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function Documents() {
  const { id } = useParams();
  const trip = useTrip(id);
  const rows = useDocuments(id);
  const { toast } = useUi();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    void uploadPendingDocuments();
    const on = () => void uploadPendingDocuments();
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, []);
  if (!trip || !rows) return <div className="p-6 text-slate2">Loading…</div>;

  async function view(d: TripDocument) {
    const url = await documentUrl(d);
    if (!url) return toast(d.file_name ? 'File is not available offline yet. Connect to the internet and try again.' : 'No file attached');
    window.open(url, '_blank');
  }

  return (
    <div>
      <TopBar title="Documents" sub={trip.name} back={`/trips/${trip.id}`} right={<Button small variant="ghost" icon="Plus" onClick={() => setOpen(true)}>Add</Button>} />
      <div className="px-4 pb-10 space-y-2.5">
        {rows.length === 0 ? <EmptyState icon="FileText" title="No documents yet" body="Store tickets, IDs, bookings and prescriptions for this trip. Files stay on your device and in your private cloud storage." action={<Button icon="Plus" onClick={() => setOpen(true)}>Add document</Button>} /> :
          rows.map((d) => (
            <div key={d.id} className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-3">
              <span className="h-11 w-11 rounded-xl bg-teal-50 text-teal grid place-items-center shrink-0"><Icon name={d.file_name ? 'Paperclip' : 'FileText'} size={20} /></span>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold truncate">{d.title}</p>
                <p className="text-xs text-slate2 truncate">{[d.kind, d.file_name, size(d.size_bytes)].filter(Boolean).join(' · ')}</p>
                {d.notes && <p className="text-xs text-slate2 truncate">{d.notes}</p>}
                {d.file_name && <Chip tone={d.storage_path ? 'ok' : 'warn'}>{d.storage_path ? 'Backed up' : 'Waiting to upload'}</Chip>}
              </div>
              {d.file_name && <button aria-label={`Open ${d.title}`} className="h-9 w-9 grid place-items-center text-teal" onClick={() => void view(d)}><Icon name="ExternalLink" size={18} /></button>}
              <button aria-label={`Remove ${d.title}`} className="h-9 w-9 grid place-items-center text-slate-400" onClick={async () => { await removeRow('documents', d.id); toast('Document removed', { label: 'Undo', run: () => { void restoreRow('documents', d.id); } }); }}><Icon name="Trash2" size={17} /></button>
            </div>
          ))}
      </div>
      {open && <Form tripId={trip.id} onClose={() => setOpen(false)} />}
    </div>
  );
}

function Form({ tripId, onClose }: { tripId: string; onClose: () => void }) {
  const [f, setF] = useState({ title: '', kind: 'ID proof', notes: '' });
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState('');
  const input = useRef<HTMLInputElement>(null);
  async function save() {
    try { await addDocument({ trip_id: tripId, ...f, title: f.title.trim() || file?.name || f.kind, file }); onClose(); }
    catch (e) { setErr((e as Error).message); }
  }
  return (
    <Sheet open onClose={onClose} title="Add document">
      <div className="space-y-3">
        <Field label="Title"><Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Aadhaar, course registration" /></Field>
        <Field label="Type"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</Select></Field>
        <div>
          <Button variant="secondary" icon="Paperclip" onClick={() => input.current?.click()}>{file ? file.name : 'Attach file or photo (optional)'}</Button>
          <input ref={input} type="file" accept="image/*,application/pdf" className="hidden" aria-label="Attach file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <Field label="Notes (optional)"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        {err && <p className="text-danger text-sm font-semibold" role="alert">{err}</p>}
        <Button full onClick={save}>Save</Button>
      </div>
    </Sheet>
  );
}
