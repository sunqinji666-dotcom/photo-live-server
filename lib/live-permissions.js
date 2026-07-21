async function canManageLive(executor, user, liveId) {
    if (!user || !liveId) {
        return false;
    }

    if (user.role === 'admin') {
        return true;
    }

    const [rows] = await executor.query(
        `SELECT l.id
         FROM lives l
         LEFT JOIN live_members lm ON lm.live_id = l.id AND lm.user_id = ?
         WHERE l.id = ?
           AND (l.created_by = ? OR lm.user_id IS NOT NULL)
         LIMIT 1`,
        [user.id, Number(liveId), user.id]
    );

    return Boolean(rows[0]);
}

async function assertManageLive(executor, user, liveId) {
    const allowed = await canManageLive(executor, user, liveId);
    if (!allowed) {
        const error = new Error('你没有权限管理这个相册');
        error.statusCode = 403;
        throw error;
    }
}

function buildManageLiveWhere(user, liveAlias = 'l') {
    if (user?.role === 'admin') {
        return {
            join: '',
            where: '1 = 1',
            params: []
        };
    }

    return {
        join: `LEFT JOIN live_members lm_scope ON lm_scope.live_id = ${liveAlias}.id AND lm_scope.user_id = ?`,
        where: `(${liveAlias}.created_by = ? OR lm_scope.user_id IS NOT NULL)`,
        params: [user.id, user.id]
    };
}

module.exports = {
    assertManageLive,
    buildManageLiveWhere,
    canManageLive
};
