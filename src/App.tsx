import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { People } from './pages/People';
import { PersonDetail } from './pages/PersonDetail';
import { ARViewer } from './pages/ARViewer';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* AR Viewer - Full screen without sidebar */}
        <Route path="/ar" element={<ARViewer />} />

        {/* Admin Portal with sidebar */}
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/people" element={<People />} />
          <Route path="/people/:id" element={<PersonDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
