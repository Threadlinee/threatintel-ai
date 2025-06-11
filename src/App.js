import logo from './logo.svg';
import './App.css';
import LandingPage from './components/LandingPage';

function App() {
  return (
    <div className="App">
      <div className="container">
        <div className="header">
            <h1>ThreatIntel AI</h1>
        </div>
        <div className="content">
          <LandingPage />
        </div>
      </div>
    </div>
  );
}

export default App;
