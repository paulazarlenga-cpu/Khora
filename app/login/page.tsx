import { login } from "./actions";
import { KhoraLogo } from "../khora-logo";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><KhoraLogo variant="full" size="lg" theme="green" /></div>
        <div className="login-copy">
          <p>ACCESO SEGURO</p>
          <h1>Ingresá a tu negocio</h1>
          <span>Usá la cuenta administradora autorizada para continuar.</span>
        </div>
        <form action={login} className="login-form">
          <label>
            <span>Email</span>
            <input type="email" name="email" defaultValue="paulazarlenga@gmail.com" autoComplete="email" required />
          </label>
          <label>
            <span>Contraseña</span>
            <input type="password" name="password" autoComplete="current-password" placeholder="Tu contraseña" required />
          </label>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button type="submit">Ingresar</button>
        </form>
        <footer>Acceso privado · Los datos del negocio están protegidos</footer>
      </section>
    </main>
  );
}
