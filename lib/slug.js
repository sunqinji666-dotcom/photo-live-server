function slugify(input = '', eventDate = '') {
    const normalized = String(input)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-')
        .slice(0, 48);

    if (normalized) {
        return normalized;
    }

    return buildNumericSlug(eventDate);
}

function buildNumericSlug(eventDate = '') {
    const base = eventDate ? new Date(eventDate) : new Date();
    const safeDate = Number.isNaN(base.getTime()) ? new Date() : base;
    const yyyy = safeDate.getFullYear();
    const mm = String(safeDate.getMonth() + 1).padStart(2, '0');
    const dd = String(safeDate.getDate()).padStart(2, '0');
    const hh = String(safeDate.getHours()).padStart(2, '0');
    const mi = String(safeDate.getMinutes()).padStart(2, '0');
    const ss = String(safeDate.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

module.exports = {
    slugify
};
