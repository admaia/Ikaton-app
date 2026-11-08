export const dynamic = 'force-static';

export default function Offline() {
  return (
    <main className="flex min-h-dvh flex-col justify-center gap-5 px-6">
      <p className="m-0 text-[10px] font-bold uppercase tracking-[.3em] text-accent-text">Hors connexion</p>
      <h1 className="m-0 font-serif text-[44px] uppercase leading-[.98] tracking-[-.025em]">Pas de réseau</h1>
      <p className="m-0 text-[15px] font-medium leading-relaxed">
        Ikàton n’affiche jamais un solde ou un paiement qu’il ne peut pas vérifier. Reconnectez-vous pour voir vos cercles à jour.
      </p>
    </main>
  );
}
