function normalizeDetail(detail) {
    if (!detail) {
        return '';
    }

    if (typeof detail === 'string') {
        return detail;
    }

    try {
        return JSON.stringify(detail);
    } catch (_error) {
        return String(detail);
    }
}

async function logActivity(executor, payload) {
    const {
        liveId,
        user = null,
        action,
        targetType = '',
        targetId = null,
        detail = ''
    } = payload;

    if (!liveId || !action) {
        return;
    }

    await executor.query(
        `INSERT INTO activity_logs
         (live_id, user_id, actor_name, action, target_type, target_id, detail)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            Number(liveId),
            user?.id || null,
            user?.nickname || user?.username || '系统',
            action,
            targetType,
            targetId,
            normalizeDetail(detail)
        ]
    );
}

module.exports = {
    logActivity
};
