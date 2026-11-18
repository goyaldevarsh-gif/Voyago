import { Link, useNavigate } from 'react-router-dom';
import { Card, Chip, EmptyState, TopBar, Button, useUi } from '../components/ui';
import { Icon } from '../components/icons';
import { useTemplates } from '../hooks/data';
import { DEFAULT_TEMPLATES } from '../data/templates';
import { createTemplate } from '../db/repo';

export default function Templates() {
  const mine = useTemplates();
  const nav = useNavigate();
  const { toast } = useUi();

  async function blank() {
    const name = window.prompt('Template name');
    if (!name?.trim()) return;
    const t = await createTemplate({ name: name.trim(), description: '', trip_type: 'other', nights: 3 });
    toast('Template created');
    nav(`/templates/mine/${t.id}`);
  }

  return (
    <div>
      <TopBar title="Packing templates" right={<Button small variant="ghost" icon="Plus" onClick={blank}>New</Button>} />
      <div className="px-4 pb-6">
        <h2 className="text-sm font-extrabold text-slate2 uppercase tracking-wide mb-2">My templates</h2>
        {!mine ? null : mine.length === 0 ? (
          <Card><EmptyState icon="LayoutTemplate" title="No personal templates" body="Open any trip and choose Save as template, or create a blank one." /></Card>
        ) : (
          <div className="space-y-2.5">
            {mine.map((t) => (
              <Link key={t.id} to={`/templates/mine/${t.id}`} className="block">
                <Card className="p-4 flex items-center gap-3">
                  <span className="h-11 w-11 rounded-xl bg-teal-50 text-teal grid place-items-center"><Icon name="LayoutTemplate" size={20} /></span>
                  <div className="flex-1 min-w-0"><p className="font-extrabold truncate">{t.name}</p><p className="text-xs text-slate2 truncate">{t.description || `${t.nights} nights`}</p></div>
                  <Icon name="ChevronRight" size={18} className="text-slate-300" />
                </Card>
              </Link>
            ))}
          </div>
        )}

        <h2 className="text-sm font-extrabold text-slate2 uppercase tracking-wide mt-6 mb-2">Ready-made</h2>
        <div className="grid grid-cols-2 gap-3">
          {DEFAULT_TEMPLATES.map((t) => (
            <Link key={t.id} to={`/templates/default/${t.id}`}>
              <div className={`rounded-2xl p-4 h-32 text-white bg-gradient-to-br ${t.tone} relative overflow-hidden`}>
                <Icon name={t.icon} size={64} className="absolute -right-3 -bottom-3 text-white/20" />
                <p className="font-extrabold leading-tight relative">{t.name}</p>
                <p className="text-xs text-white/85 mt-1 relative">{t.blurb}</p>
                {t.tags.includes('international') && <Chip tone="soon">Passport</Chip>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
