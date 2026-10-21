import { BasisSessionProvider } from '@/lib/session/basis-session.js';
import { AppRoutes } from '@/routes/index.js';

export function App() {
  return (
    <BasisSessionProvider>
      <AppRoutes />
    </BasisSessionProvider>
  );
}
