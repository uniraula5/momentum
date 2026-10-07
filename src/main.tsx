import React from 'react';
import { createRoot } from 'react-dom/client';
import Tracker from './components/Tracker';
import { phoneStorage } from './platform/storage';
import './styles/globals.css';
import './styles/mobile.css';
import PrivateArea from './components/PrivateArea';
class ErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="boot"><h1>Let’s reopen your tracker.</h1><p>Your saved data is still on this phone.</p><button onClick={() => location.reload()}>Reopen Momentum</button></div>;
    return this.props.children;
  }
}
function App() {
  const [privateArea, setPrivateArea] = React.useState(false);
  return privateArea ? <PrivateArea onExit={() => setPrivateArea(false)} /> : <Tracker storage={phoneStorage} onPrivate={() => setPrivateArea(true)} />;
}
createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>);
