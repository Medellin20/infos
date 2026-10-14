import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Emploi du temps enseignant',
  description: 'Formulaire de saisie d\'emploi du temps pour les enseignants',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="font-sans">{children}</body>
    </html>
  );
}
