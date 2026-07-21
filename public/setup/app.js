const elements = {
    statusText: document.getElementById('statusText'),
    setupForm: document.getElementById('setupForm'),
    testDbButton: document.getElementById('testDbButton'),
    dbTestResult: document.getElementById('dbTestResult'),
    storageModeInput: document.getElementById('storageModeInput'),
    qiniuFields: document.getElementById('qiniuFields'),
    publicBaseUrlInput: document.getElementById('publicBaseUrlInput'),
    jwtSecretInput: document.getElementById('jwtSecretInput'),
    dbHostInput: document.getElementById('dbHostInput'),
    dbPortInput: document.getElementById('dbPortInput'),
    dbNameInput: document.getElementById('dbNameInput'),
    dbUserInput: document.getElementById('dbUserInput'),
    dbPasswordInput: document.getElementById('dbPasswordInput'),
    qiniuAccessKeyInput: document.getElementById('qiniuAccessKeyInput'),
    qiniuSecretKeyInput: document.getElementById('qiniuSecretKeyInput'),
    qiniuBucketInput: document.getElementById('qiniuBucketInput'),
    qiniuZoneInput: document.getElementById('qiniuZoneInput'),
    qiniuDomainInput: document.getElementById('qiniuDomainInput'),
    adminUsernameInput: document.getElementById('adminUsernameInput'),
    adminNicknameInput: document.getElementById('adminNicknameInput'),
    adminPasswordInput: document.getElementById('adminPasswordInput')
};

init().catch((error) => {
    elements.statusText.textContent = error.message || '安装器初始化失败';
});

async function init() {
    bindEvents();
    const response = await api('/setup/status');
    elements.statusText.textContent = response.data.setup_required
        ? '当前检测到系统尚未完成安装，请按顺序填写配置。'
        : '当前环境已可用；如需重新安装，请直接覆盖配置后重新执行。';
    elements.publicBaseUrlInput.value = window.location.origin;
    elements.jwtSecretInput.value = createSetupSecret();
}

function bindEvents() {
    elements.storageModeInput.addEventListener('change', () => {
        elements.qiniuFields.hidden = elements.storageModeInput.value !== 'qiniu';
    });

    elements.testDbButton.addEventListener('click', async () => {
        elements.dbTestResult.textContent = '正在测试数据库连接…';
        try {
            await api('/setup/test-db', {
                method: 'POST',
                body: JSON.stringify(buildPayload())
            });
            elements.dbTestResult.textContent = '数据库连接成功，可以继续安装。';
        } catch (error) {
            elements.dbTestResult.textContent = error.message || '数据库连接失败';
        }
    });

    elements.setupForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        elements.statusText.textContent = '正在执行安装，请稍候…';
        try {
            const response = await api('/setup/install', {
                method: 'POST',
                body: JSON.stringify(buildPayload())
            });
            elements.statusText.textContent = `${response.message} 现在重启服务后即可正常进入后台。`;
        } catch (error) {
            elements.statusText.textContent = error.message || '安装失败';
        }
    });
}

function buildPayload() {
    return {
        public_base_url: elements.publicBaseUrlInput.value.trim(),
        jwt_secret: elements.jwtSecretInput.value.trim(),
        db_host: elements.dbHostInput.value.trim(),
        db_port: elements.dbPortInput.value.trim(),
        db_name: elements.dbNameInput.value.trim(),
        db_user: elements.dbUserInput.value.trim(),
        db_password: elements.dbPasswordInput.value,
        storage_mode: elements.storageModeInput.value,
        qiniu_access_key: elements.qiniuAccessKeyInput.value.trim(),
        qiniu_secret_key: elements.qiniuSecretKeyInput.value.trim(),
        qiniu_bucket: elements.qiniuBucketInput.value.trim(),
        qiniu_zone: elements.qiniuZoneInput.value.trim(),
        qiniu_domain: elements.qiniuDomainInput.value.trim(),
        admin_username: elements.adminUsernameInput.value.trim(),
        admin_nickname: elements.adminNicknameInput.value.trim(),
        admin_password: elements.adminPasswordInput.value
    };
}

async function api(path, options = {}) {
    const response = await fetch(`/api${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || '请求失败');
    }
    return data;
}

function createSetupSecret() {
    try {
        if (window.crypto?.randomUUID) {
            return window.crypto.randomUUID().replace(/-/g, '');
        }
    } catch (_error) {
    }

    try {
        if (window.crypto?.getRandomValues) {
            const bytes = new Uint8Array(24);
            window.crypto.getRandomValues(bytes);
            return Array.from(bytes).map((value) => value.toString(16).padStart(2, '0')).join('');
        }
    } catch (_error) {
    }

    return `photo_live_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}
