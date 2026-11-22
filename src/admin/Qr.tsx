import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** A big QR code and the address, to screenshot into the first slide. */
export default function Qr() {
    const url = window.location.origin;
    const [image, setImage] = useState<string | null>(null);

    useEffect(() => {
        QRCode.toDataURL(url, { width: 800, margin: 1 })
            .then(setImage)
            .catch(() => setImage(null));
    }, [url]);

    return (
        <main className="flex flex-col items-center gap-6 px-4 py-10">
            <h1 className="font-display text-4xl font-bold text-accent">
                Arvaa vauvan nimi!
            </h1>
            {image && (
                <img
                    src={image}
                    alt={`QR-koodi osoitteeseen ${url}`}
                    className="w-full max-w-md rounded-2xl bg-sheet p-4"
                />
            )}
            <p className="text-3xl font-bold break-all text-ink">
                {url.replace(/^https?:\/\//, '')}
            </p>
        </main>
    );
}
