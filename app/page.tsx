import { Table } from '@/components/table';
import phraseTranslations from '@/data/french/2000verbs/phrase-translations.json';

export default function Home() {
  return (
      <main className="min-h-screen">
        <Table sentences={phraseTranslations} />
      </main>
  );
}
