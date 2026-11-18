import { TopBar, EmptyState } from '../components/ui';
import { useParams } from 'react-router-dom';

export default function Chat() {
  const { tripId } = useParams();
  return (
    <div>
      <TopBar title="Voyago AI" back={tripId ? `/trips/${tripId}` : '/'} />
      <EmptyState icon="Sparkles" title="AI chat is being connected" body="The assistant needs its secure server function, which is being set up last. Everything else in Voyago works without it." />
    </div>
  );
}
