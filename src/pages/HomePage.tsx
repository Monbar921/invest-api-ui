import { Navigate } from 'react-router';
import { useSession } from '../api/session';
import { LandingPage } from './LandingPage';

/** «/»: гость видит лендинг, вошедший - сразу список облигаций */
export function HomePage() {
  const { authenticated } = useSession();
  return authenticated ? <Navigate to="/bonds" replace /> : <LandingPage />;
}
