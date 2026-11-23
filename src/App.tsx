import { Navigate, Route, Routes } from 'react-router-dom';
import GuestApp from './guest/GuestApp';
import AdminLayout from './admin/AdminLayout';
import Control from './admin/Control';
import Results from './admin/Results';
import WrongGuesses from './admin/WrongGuesses';
import Qr from './admin/Qr';

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<GuestApp />} />
            <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Control />} />
                <Route path="tulokset" element={<Results />} />
                <Route path="vaarat" element={<WrongGuesses />} />
                <Route path="qr" element={<Qr />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
