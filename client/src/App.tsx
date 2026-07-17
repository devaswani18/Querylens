import SchemaExplorer from './components/SchemaExplorer';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-xs border-r border-slate-800">
        <SchemaExplorer />
      </div>
    </div>
  );
}