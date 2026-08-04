import { LandingView } from "./landing-view";

/**
 * La URL propia del landing. El componente vive en `landing-view.tsx` porque
 * la raíz también lo renderiza cuando no hay sesión.
 */
export default function LandingPage() {
  return <LandingView />;
}
