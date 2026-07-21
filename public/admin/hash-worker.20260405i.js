self.onmessage = async (event) => {
    const { id, buffer } = event.data || {};

    try {
        let hash;
        if (self.crypto?.subtle?.digest) {
            const hashBuffer = await self.crypto.subtle.digest('SHA-256', buffer);
            hash = Array.from(new Uint8Array(hashBuffer))
                .map((byte) => byte.toString(16).padStart(2, '0'))
                .join('');
        } else {
            hash = fingerprintBuffer(buffer);
        }

        self.postMessage({ id, hash });
    } catch (error) {
        self.postMessage({
            id,
            error: error?.message || 'hash-failed'
        });
    }
};

function fingerprintBuffer(buffer) {
    const bytes = new Uint8Array(buffer);
    let hashA = 1469598103934665603n;
    let hashB = 1099511628211n;
    const prime = 1099511628211n;
    const mask = (1n << 64n) - 1n;

    for (const byte of bytes) {
        hashA ^= BigInt(byte);
        hashA = (hashA * prime) & mask;
        hashB ^= (BigInt(byte) + 17n);
        hashB = (hashB * (prime + 13n)) & mask;
    }

    return `${hashA.toString(16).padStart(16, '0')}${hashB.toString(16).padStart(16, '0')}`;
}
