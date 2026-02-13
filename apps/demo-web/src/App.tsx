import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Demo Web App</h1>
      <p>This is a demo web application in the monorepo.</p>
      <button
        onClick={() => setCount(count + 1)}
        style={{
          padding: '0.5rem 1rem',
          fontSize: '1rem',
          cursor: 'pointer',
        }}
      >
        Count: {count}
      </button>
    </div>
  );
}

export default App;
