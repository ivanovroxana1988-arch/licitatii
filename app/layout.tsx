export const metadata = {
  title: "Motor de Licitații",
  description: "Gestiune dosare experți pentru achiziții publice",
};

const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: #f6f8fb; color: #11161d; -webkit-font-smoothing: antialiased;
  }
  a { color: inherit; }
  input, button, select, textarea { font-family: inherit; }
  button { cursor: pointer; }
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
