import React, { useState } from 'react';
import EnvSelect from './components/EnvSelect.jsx';
import MainView from './components/MainView.jsx';

export default function App() {
  const [env, setEnv] = useState(null);

  if (!env) {
    return <EnvSelect onSelect={setEnv} />;
  }

  return <MainView env={env} onReset={() => setEnv(null)} />;
}
