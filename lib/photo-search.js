const path = require('path');

function buildPhotoSearchFields({ title = '', description = '', tags = [], originalName = '', exifData = {} } = {}) {
    const normalizedExif = normalizeExif(exifData);
    const normalizedTags = normalizeTags(tags);
    const cameraSearch = normalizeText(
        normalizedExif.camera ||
        normalizedExif.cameraModel ||
        normalizedExif.camera_model ||
        normalizedExif.model
    );
    const lensSearch = normalizeText(
        normalizedExif.lens ||
        normalizedExif.lensModel ||
        normalizedExif.lens_model
    );
    const focalLengthSearch = normalizeText(
        normalizedExif.focalLength ||
        normalizedExif.focal_length ||
        normalizedExif.focal
    );
    const apertureSearch = normalizeAperture(
        normalizedExif.aperture ||
        normalizedExif.fNumber ||
        normalizedExif.f_number
    );
    const shutterSpeedSearch = normalizeText(
        normalizedExif.shutterSpeed ||
        normalizedExif.shutter_speed ||
        normalizedExif.exposureTime ||
        normalizedExif.exposure_time
    );
    const isoValue = normalizeInt(normalizedExif.iso || normalizedExif.ISO);
    const formatValue = normalizeFormat(normalizedExif.format || path.extname(String(originalName || '')));
    const searchText = buildSearchText([
        title,
        description,
        normalizedTags.join(' '),
        originalName,
        cameraSearch,
        lensSearch,
        focalLengthSearch,
        apertureSearch,
        shutterSpeedSearch,
        isoValue ? `iso ${isoValue}` : '',
        formatValue
    ]);

    return {
        camera_search: cameraSearch,
        lens_search: lensSearch,
        focal_length_search: focalLengthSearch,
        aperture_search: apertureSearch,
        shutter_speed_search: shutterSpeedSearch,
        iso_value: isoValue,
        format_value: formatValue,
        search_text: searchText
    };
}

function buildSearchText(parts) {
    const unique = new Set();
    parts.forEach((value) => {
        const normalized = normalizeText(value);
        if (!normalized) {
            return;
        }

        normalized.split(' ').filter(Boolean).forEach((token) => unique.add(token));
        unique.add(normalized);
    });
    return Array.from(unique).join(' ').trim();
}

function normalizeTags(tags) {
    if (Array.isArray(tags)) {
        return tags.map((tag) => normalizeText(tag)).filter(Boolean);
    }

    if (typeof tags === 'string') {
        const trimmed = tags.trim();
        if (!trimmed) {
            return [];
        }

        if (trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    return parsed.map((tag) => normalizeText(tag)).filter(Boolean);
                }
            } catch (_error) {
                return [];
            }
        }

        return trimmed.split(',').map((tag) => normalizeText(tag)).filter(Boolean);
    }

    return [];
}

function normalizeExif(exifData) {
    if (!exifData) {
        return {};
    }

    if (typeof exifData === 'string') {
        try {
            return JSON.parse(exifData) || {};
        } catch (_error) {
            return {};
        }
    }

    return exifData;
}

function normalizeFormat(format) {
    const normalized = normalizeText(String(format || '').replace(/^\./, ''));
    if (!normalized) {
        return '';
    }

    const aliasMap = {
        jpeg: 'jpg',
        tiff: 'tif'
    };
    return aliasMap[normalized] || normalized;
}

function normalizeAperture(value) {
    const normalized = normalizeText(value);
    if (!normalized) {
        return '';
    }

    if (/^f\s*\/?\s*\d/i.test(normalized)) {
        return normalized.replace(/^f\s*/i, 'f/').replace(/\s+/g, '');
    }

    return normalized;
}

function normalizeInt(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFKC')
        .trim()
        .toLowerCase()
        .replace(/[_/\\]+/g, ' ')
        .replace(/\s+/g, ' ');
}

module.exports = {
    buildPhotoSearchFields
};
