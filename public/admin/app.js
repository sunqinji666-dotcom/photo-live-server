const state = {
    token: localStorage.getItem('photo_live_token') || '',
    user: null,
    storageMode: 'local',
    lives: [],
    currentLive: null,
    albums: [],
    photos: [],
    photoDetails: {},
    photoDetailLoading: new Set(),
    photoPage: 1,
    photoPages: 1,
    photoTotal: 0,
    photoLoadingMore: false,
    logs: [],
    analytics: null,
    users: [],
    adminSmartFiltersOpen: false,
    currentSection: 'photos',
    currentView: 'library',
    selectedPhotoId: null,
    selectedPhotoIds: new Set(),
    photoRenderCount: 0,
    photoRenderChunkSize: 36,
    batchMode: false,
    loadingLibrary: false,
    loadingDetail: false,
    inspectorPulseTimer: 0,
    cleanupJob: null,
    cleanupPollTimer: 0,
    cleanupWidgetVisible: false,
    deleteTask: {
        active: false,
        running: false,
        phase: 'waiting',
        title: '',
        summary: '',
        total: 0,
        completed: 0,
        errors: []
    },
    deleteTaskPollTimer: 0,
    uploadSession: {
        active: false,
        uploading: false,
        startedAt: 0,
        totalBytes: 0,
        uploadedBytes: 0,
        completedCount: 0,
        registeredCount: 0,
        phase: 'waiting',
        items: []
    },
    bannerDraftFile: null,
    bannerDraftPreviewUrl: '',
    openingDraftFile: null,
    openingDraftPreviewUrl: '',
    filters: {
        keyword: '',
        albumId: 'all',
        visibility: 'all',
        sort: 'latest',
        camera: '',
        lens: '',
        focalLength: '',
        aperture: '',
        iso: '',
        format: ''
    },
    inspectorPreviewUpgradeTimer: 0
};

const isSafariLike = (() => {
    const ua = navigator.userAgent;
    if (/iP(hone|ad|od)/i.test(ua) && /AppleWebKit/i.test(ua)) {
        return true;
    }
    return /Safari/i.test(ua) && !/Chrome|Chromium|Android|CriOS|FxiOS|EdgiOS|Edg\//i.test(ua);
})();

const DIRECT_UPLOAD_PREPARE_BATCH_SIZE = 30;
const HASH_CONCURRENCY = 6;
const DIRECT_UPLOAD_CONCURRENCY = 5;
const SERVER_UPLOAD_CONCURRENCY = 4;
const DELETE_CONCURRENCY = 8;
const HASH_WORKER_URL = '/admin-assets/hash-worker.20260405i.js';

const elements = {
    accessCodeInput: document.getElementById('accessCodeInput'),
    activityForm: document.getElementById('activityForm'),
    albumForm: document.getElementById('albumForm'),
    albumIconInput: document.getElementById('albumIconInput'),
    albumList: document.getElementById('albumList'),
    albumNameInput: document.getElementById('albumNameInput'),
    albumSortInput: document.getElementById('albumSortInput'),
    adminSmartFilterToggleButton: document.getElementById('adminSmartFilterToggleButton'),
    adminSmartFilters: document.getElementById('adminSmartFilters'),
    clearAdminSmartFiltersButton: document.getElementById('clearAdminSmartFiltersButton'),
    analyticsDevices: document.getElementById('analyticsDevices'),
    analyticsLocations: document.getElementById('analyticsLocations'),
    analyticsRecentVisitors: document.getElementById('analyticsRecentVisitors'),
    analyticsSummaryGrid: document.getElementById('analyticsSummaryGrid'),
    analyticsTopAlbums: document.getElementById('analyticsTopAlbums'),
    analyticsTopPhotos: document.getElementById('analyticsTopPhotos'),
    allowBatchDownloadInput: document.getElementById('allowBatchDownloadInput'),
    allowOriginalDownloadInput: document.getElementById('allowOriginalDownloadInput'),
    allowWatermarkedDownloadInput: document.getElementById('allowWatermarkedDownloadInput'),
    backToLibraryButton: document.getElementById('backToLibraryButton'),
    bannerInput: document.getElementById('bannerInput'),
    bannerFileInput: document.getElementById('bannerFileInput'),
    bannerPreviewImage: document.getElementById('bannerPreviewImage'),
    bannerPreviewPlaceholder: document.getElementById('bannerPreviewPlaceholder'),
    openingInput: document.getElementById('openingInput'),
    openingFileInput: document.getElementById('openingFileInput'),
    openingPreviewImage: document.getElementById('openingPreviewImage'),
    openingPreviewPlaceholder: document.getElementById('openingPreviewPlaceholder'),
    batchEditorAlbumSelect: document.getElementById('batchEditorAlbumSelect'),
    batchEditorTagsInput: document.getElementById('batchEditorTagsInput'),
    batchDeletePhotosButton: document.getElementById('batchDeletePhotosButton'),
    batchInspectorApplyAlbumButton: document.getElementById('batchInspectorApplyAlbumButton'),
    batchInspectorApplyTagsButton: document.getElementById('batchInspectorApplyTagsButton'),
    batchInspectorDeleteButton: document.getElementById('batchInspectorDeleteButton'),
    batchInspectorHideButton: document.getElementById('batchInspectorHideButton'),
    batchInspectorMeta: document.getElementById('batchInspectorMeta'),
    batchInspectorShowButton: document.getElementById('batchInspectorShowButton'),
    batchInspectorStack: document.getElementById('batchInspectorStack'),
    batchCopyOriginalLinksButton: document.getElementById('batchCopyOriginalLinksButton'),
    batchCopyPreviewLinksButton: document.getElementById('batchCopyPreviewLinksButton'),
    batchHidePhotosButton: document.getElementById('batchHidePhotosButton'),
    batchSelectionText: document.getElementById('batchSelectionText'),
    batchShowPhotosButton: document.getElementById('batchShowPhotosButton'),
    batchToolbar: document.getElementById('batchToolbar'),
    clearSelectedPhotosButton: document.getElementById('clearSelectedPhotosButton'),
    cleanupDataButton: document.getElementById('cleanupDataButton'),
    cleanupPhaseText: document.getElementById('cleanupPhaseText'),
    cleanupProgressBar: document.getElementById('cleanupProgressBar'),
    cleanupProgressText: document.getElementById('cleanupProgressText'),
    cleanupStats: document.getElementById('cleanupStats'),
    cleanupSummaryText: document.getElementById('cleanupSummaryText'),
    cleanupWidget: document.getElementById('cleanupWidget'),
    closeCleanupWidgetButton: document.getElementById('closeCleanupWidgetButton'),
    closeDeleteWidgetButton: document.getElementById('closeDeleteWidgetButton'),
    closeUploadSessionButton: document.getElementById('closeUploadSessionButton'),
    copyLinkButton: document.getElementById('copyLinkButton'),
    copyOriginalPhotoLinkButton: document.getElementById('copyOriginalPhotoLinkButton'),
    copyPreviewPhotoLinkButton: document.getElementById('copyPreviewPhotoLinkButton'),
    coverInput: document.getElementById('coverInput'),
    dashboard: document.getElementById('dashboard'),
    deletePhotoButton: document.getElementById('deletePhotoButton'),
    deletePhaseText: document.getElementById('deletePhaseText'),
    deleteProgressBar: document.getElementById('deleteProgressBar'),
    deleteProgressText: document.getElementById('deleteProgressText'),
    deleteStats: document.getElementById('deleteStats'),
    deleteSummaryText: document.getElementById('deleteSummaryText'),
    deleteWidget: document.getElementById('deleteWidget'),
    descriptionInput: document.getElementById('descriptionInput'),
    detailScreen: document.getElementById('detailScreen'),
    downloadFilteredButton: document.getElementById('downloadFilteredButton'),
    editorAlbumSelect: document.getElementById('editorAlbumSelect'),
    editorDescriptionInput: document.getElementById('editorDescriptionInput'),
    editorMeta: document.getElementById('editorMeta'),
    editorOriginalLink: document.getElementById('editorOriginalLink'),
    editorPreviewImage: document.getElementById('editorPreviewImage'),
    editorTagsInput: document.getElementById('editorTagsInput'),
    editorTitleInput: document.getElementById('editorTitleInput'),
    editorVisibilitySelect: document.getElementById('editorVisibilitySelect'),
    enableShareInput: document.getElementById('enableShareInput'),
    enableClientLinkCopyInput: document.getElementById('enableClientLinkCopyInput'),
    eventDateInput: document.getElementById('eventDateInput'),
    guestUploadInput: document.getElementById('guestUploadInput'),
    heroSummary: document.getElementById('heroSummary'),
    heroTitle: document.getElementById('heroTitle'),
    layoutModeInput: document.getElementById('layoutModeInput'),
    libraryScreen: document.getElementById('libraryScreen'),
    liveCountText: document.getElementById('liveCountText'),
    liveIdInput: document.getElementById('liveIdInput'),
    liveList: document.getElementById('liveList'),
    locationInput: document.getElementById('locationInput'),
    logList: document.getElementById('logList'),
    loginForm: document.getElementById('loginForm'),
    loginScreen: document.getElementById('loginScreen'),
    logoutButton: document.getElementById('logoutButton'),
    metricGrid: document.getElementById('metricGrid'),
    musicInput: document.getElementById('musicInput'),
    overviewGrid: document.getElementById('sidebarOverview'),
    photoAlbumFilter: document.getElementById('photoAlbumFilter'),
    photoCountText: document.getElementById('photoCountText'),
    photoEditorForm: document.getElementById('photoEditorForm'),
    photoGallery: document.getElementById('photoGallery'),
    photoGallerySentinel: document.getElementById('photoGallerySentinel'),
    photoCameraFilter: document.getElementById('photoCameraFilter'),
    photoLensFilter: document.getElementById('photoLensFilter'),
    photoFocalLengthFilter: document.getElementById('photoFocalLengthFilter'),
    photoApertureFilter: document.getElementById('photoApertureFilter'),
    photoIsoFilter: document.getElementById('photoIsoFilter'),
    photoFormatFilter: document.getElementById('photoFormatFilter'),
    photoBatchInspector: document.getElementById('photoBatchInspector'),
    photoInspectorContent: document.getElementById('photoInspectorContent'),
    photoInspectorEmpty: document.getElementById('photoInspectorEmpty'),
    photoSearchInput: document.getElementById('photoSearchInput'),
    photoSortFilter: document.getElementById('photoSortFilter'),
    photoVisibilityFilter: document.getElementById('photoVisibilityFilter'),
    previewLink: document.getElementById('previewLink'),
    quickCreateForm: document.getElementById('quickCreateForm'),
    quickDateInput: document.getElementById('quickDateInput'),
    quickLocationInput: document.getElementById('quickLocationInput'),
    quickTitleInput: document.getElementById('quickTitleInput'),
    refreshButton: document.getElementById('refreshButton'),
    requireReviewInput: document.getElementById('requireReviewInput'),
    pickBannerImageButton: document.getElementById('pickBannerImageButton'),
    uploadBannerImageButton: document.getElementById('uploadBannerImageButton'),
    clearBannerImageButton: document.getElementById('clearBannerImageButton'),
    pickOpeningImageButton: document.getElementById('pickOpeningImageButton'),
    uploadOpeningImageButton: document.getElementById('uploadOpeningImageButton'),
    clearOpeningImageButton: document.getElementById('clearOpeningImageButton'),
    selectAllPhotosButton: document.getElementById('selectAllPhotosButton'),
    sectionTabs: Array.from(document.querySelectorAll('[data-section]')),
    sectionPanels: Array.from(document.querySelectorAll('[data-panel]')),
    shareDescriptionInput: document.getElementById('shareDescriptionInput'),
    shareLinkInput: document.getElementById('shareLinkInput'),
    shareLogoInput: document.getElementById('shareLogoInput'),
    shareTips: document.getElementById('shareTips'),
    shareTitleInput: document.getElementById('shareTitleInput'),
    sharingForm: document.getElementById('sharingForm'),
    showBannerInput: document.getElementById('showBannerInput'),
    showOpeningInput: document.getElementById('showOpeningInput'),
    showPhotographerInput: document.getElementById('showPhotographerInput'),
    openingDurationInput: document.getElementById('openingDurationInput'),
    slugInput: document.getElementById('slugInput'),
    statusInput: document.getElementById('statusInput'),
    subtitleInput: document.getElementById('subtitleInput'),
    themeInput: document.getElementById('themeInput'),
    titleInput: document.getElementById('titleInput'),
    toast: document.getElementById('toast'),
    uploadComposer: document.getElementById('uploadComposer'),
    uploadAlbumSelect: document.getElementById('uploadAlbumSelect'),
    closeUploadComposerBackdrop: document.getElementById('closeUploadComposerBackdrop'),
    closeUploadComposerButton: document.getElementById('closeUploadComposerButton'),
    uploadFilesInput: document.getElementById('uploadFilesInput'),
    uploadFileList: document.getElementById('uploadFileList'),
    uploadForm: document.getElementById('uploadForm'),
    uploadSession: document.getElementById('uploadSession'),
    uploadStatusText: document.getElementById('uploadStatusText'),
    uploadSummaryText: document.getElementById('uploadSummaryText'),
    uploadTagsInput: document.getElementById('uploadTagsInput'),
    uploadTotalProgressBar: document.getElementById('uploadTotalProgressBar'),
    uploadTotalProgressText: document.getElementById('uploadTotalProgressText'),
    uploadTitlePrefixInput: document.getElementById('uploadTitlePrefixInput'),
    userForm: document.getElementById('userForm'),
    userList: document.getElementById('userList'),
    userManagementPanel: document.getElementById('userManagementPanel'),
    userName: document.getElementById('userName'),
    newNicknameInput: document.getElementById('newNicknameInput'),
    newPasswordInput: document.getElementById('newPasswordInput'),
    newUsernameInput: document.getElementById('newUsernameInput'),
    newUserRoleInput: document.getElementById('newUserRoleInput'),
    usernameInput: document.getElementById('usernameInput'),
    watermarkEnabledInput: document.getElementById('watermarkEnabledInput'),
    watermarkInput: document.getElementById('watermarkInput'),
    toggleBatchModeButton: document.getElementById('toggleBatchModeButton')
};

init().catch((error) => showToast(error.message || '初始化失败'));

async function init() {
    setupViewportCompatibility();
    bindEvents();
    await loadSystemStatus();
    if (!state.token) {
        renderLoggedOut();
        return;
    }

    try {
        await loadMe();
        await bootDashboard();
    } catch (_error) {
        resetLogin();
    }
}

function setupViewportCompatibility() {
    document.body.classList.toggle('safari-browser', isSafariLike);
    document.body.classList.toggle('webkit-browser', /AppleWebKit/i.test(navigator.userAgent));
    document.body.classList.toggle('ios-browser', /iP(hone|ad|od)/i.test(navigator.userAgent));

    const updateViewportVars = () => {
        const viewport = window.visualViewport;
        const height = Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 0);
        const width = Math.round(viewport?.width || window.innerWidth || document.documentElement.clientWidth || 0);
        if (height > 0) {
            document.documentElement.style.setProperty('--app-height', `${height}px`);
        }
        if (width > 0) {
            document.documentElement.style.setProperty('--app-width', `${width}px`);
        }
    };

    updateViewportVars();
    window.addEventListener('resize', updateViewportVars, { passive: true });
    window.addEventListener('orientationchange', updateViewportVars, { passive: true });
    window.visualViewport?.addEventListener('resize', updateViewportVars, { passive: true });
    window.visualViewport?.addEventListener('scroll', updateViewportVars, { passive: true });
}

async function loadSystemStatus() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        state.storageMode = data.storageMode || 'local';
    } catch (_error) {
        state.storageMode = 'local';
    }
}

function bindEvents() {
    elements.loginForm.addEventListener('submit', login);
    elements.logoutButton.addEventListener('click', resetLogin);
    elements.refreshButton.addEventListener('click', () => {
        refreshCurrent().catch((error) => showToast(error.message));
    });
    elements.cleanupDataButton.addEventListener('click', () => {
        startCleanupJob().catch((error) => showToast(error.message));
    });
    elements.pickBannerImageButton?.addEventListener('click', () => {
        elements.bannerFileInput?.click();
    });
    elements.bannerFileInput?.addEventListener('change', handleBannerFileChange);
    elements.uploadBannerImageButton?.addEventListener('click', () => {
        uploadBannerImage().catch((error) => showToast(error.message));
    });
    elements.clearBannerImageButton?.addEventListener('click', () => {
        clearBannerImage().catch((error) => showToast(error.message));
    });
    elements.pickOpeningImageButton?.addEventListener('click', () => {
        elements.openingFileInput?.click();
    });
    elements.openingFileInput?.addEventListener('change', handleOpeningFileChange);
    elements.uploadOpeningImageButton?.addEventListener('click', () => {
        uploadOpeningImage().catch((error) => showToast(error.message));
    });
    elements.clearOpeningImageButton?.addEventListener('click', () => {
        clearOpeningImage().catch((error) => showToast(error.message));
    });
    elements.quickCreateForm.addEventListener('submit', createLiveQuickly);
    elements.userForm?.addEventListener('submit', createUserAccount);
    elements.backToLibraryButton.addEventListener('click', () => {
        state.currentView = 'library';
        renderWorkspaceView();
    });
    elements.copyLinkButton.addEventListener('click', copyShareLink);
    elements.albumForm.addEventListener('submit', createAlbum);
    elements.uploadForm.addEventListener('submit', uploadPhotos);
    elements.photoEditorForm.addEventListener('submit', savePhotoDetails);
    elements.downloadFilteredButton.addEventListener('click', downloadFilteredPhotos);
    elements.toggleBatchModeButton.addEventListener('click', toggleBatchMode);
    elements.selectAllPhotosButton.addEventListener('click', selectAllFilteredPhotos);
    elements.clearSelectedPhotosButton.addEventListener('click', clearSelectedPhotos);
    elements.batchShowPhotosButton.addEventListener('click', () => {
        batchUpdateVisibility(1).catch((error) => showToast(error.message));
    });
    elements.batchCopyOriginalLinksButton.addEventListener('click', () => copySelectedPhotoLinks('original'));
    elements.batchCopyPreviewLinksButton.addEventListener('click', () => copySelectedPhotoLinks('preview'));
    elements.batchHidePhotosButton.addEventListener('click', () => {
        batchUpdateVisibility(0).catch((error) => showToast(error.message));
    });
    elements.batchInspectorApplyAlbumButton.addEventListener('click', () => {
        batchUpdateAlbum().catch((error) => showToast(error.message));
    });
    elements.batchInspectorApplyTagsButton.addEventListener('click', () => {
        batchAppendTags().catch((error) => showToast(error.message));
    });
    elements.batchInspectorShowButton.addEventListener('click', () => {
        batchUpdateVisibility(1).catch((error) => showToast(error.message));
    });
    elements.batchInspectorHideButton.addEventListener('click', () => {
        batchUpdateVisibility(0).catch((error) => showToast(error.message));
    });
    elements.batchInspectorDeleteButton.addEventListener('click', () => {
        batchDeleteSelectedPhotos().catch((error) => showToast(error.message));
    });
    elements.batchDeletePhotosButton.addEventListener('click', () => {
        batchDeleteSelectedPhotos().catch((error) => showToast(error.message));
    });
    elements.closeUploadSessionButton.addEventListener('click', closeUploadSession);
    elements.closeUploadComposerButton?.addEventListener('click', closeUploadComposer);
    elements.closeUploadComposerBackdrop?.addEventListener('click', closeUploadComposer);
    elements.closeCleanupWidgetButton.addEventListener('click', closeCleanupWidget);
    elements.closeDeleteWidgetButton?.addEventListener('click', closeDeleteWidget);
    elements.copyOriginalPhotoLinkButton.addEventListener('click', () => copyCurrentPhotoLink('original'));
    elements.copyPreviewPhotoLinkButton.addEventListener('click', () => copyCurrentPhotoLink('preview'));
    elements.deletePhotoButton.addEventListener('click', () => {
        if (state.selectedPhotoId) {
            deletePhoto(state.selectedPhotoId).catch((error) => showToast(error.message));
        }
    });

    document.querySelectorAll('.live-form').forEach((form) => {
        form.addEventListener('submit', saveLive);
    });

    elements.liveList.addEventListener('click', (event) => {
        const deleteButton = event.target.closest('[data-delete-live]');
        if (deleteButton) {
            deleteLive(Number(deleteButton.dataset.deleteLive)).catch((error) => showToast(error.message));
            return;
        }

        const item = event.target.closest('[data-live-id]');
        if (!item) {
            return;
        }
        selectLive(Number(item.dataset.liveId)).catch((error) => showToast(error.message));
    });

    elements.userList?.addEventListener('click', (event) => {
        const deleteButton = event.target.closest('[data-delete-user]');
        if (deleteButton) {
            deleteUserAccount(Number(deleteButton.dataset.deleteUser)).catch((error) => showToast(error.message));
        }
    });

    elements.sectionTabs.forEach((button) => {
        button.addEventListener('click', () => {
            state.currentSection = button.dataset.section;
            renderSectionTabs();
        });
    });

    elements.albumList.addEventListener('click', (event) => {
        const saveButton = event.target.closest('[data-save-album]');
        if (saveButton) {
            updateAlbum(Number(saveButton.dataset.saveAlbum)).catch((error) => showToast(error.message));
            return;
        }

        const deleteButton = event.target.closest('[data-delete-album]');
        if (deleteButton) {
            deleteAlbum(Number(deleteButton.dataset.deleteAlbum)).catch((error) => showToast(error.message));
        }
    });

    elements.photoGallery.addEventListener('click', (event) => {
        if (event.target.closest('[data-open-upload]')) {
            openUploadComposer();
            return;
        }

        const card = event.target.closest('[data-photo-id]');
        if (!card) {
            return;
        }
        const photoId = Number(card.dataset.photoId);
        if (event.target.closest('[data-manage-photo]')) {
            state.batchMode = false;
            state.selectedPhotoId = photoId;
            renderPhotoWorkspace();
            ensurePhotoDetailLoaded(photoId).catch((error) => showToast(error.message));
            return;
        }

        if (state.batchMode) {
            togglePhotoSelection(photoId);
            return;
        }

        state.selectedPhotoId = photoId;
        syncPhotoSelectionState();
        renderPhotoInspector();
        ensurePhotoDetailLoaded(photoId).catch((error) => showToast(error.message));
    });

    elements.photoSearchInput.addEventListener('input', (event) => {
        state.filters.keyword = event.target.value.trim().toLowerCase();
        resetPhotoRenderWindow();
        loadAdminPhotos(true).catch((error) => showToast(error.message));
    });

    elements.photoAlbumFilter.addEventListener('change', (event) => {
        state.filters.albumId = event.target.value;
        resetPhotoRenderWindow();
        loadAdminPhotos(true).catch((error) => showToast(error.message));
    });

    elements.photoVisibilityFilter.addEventListener('change', (event) => {
        state.filters.visibility = event.target.value;
        resetPhotoRenderWindow();
        loadAdminPhotos(true).catch((error) => showToast(error.message));
    });

    elements.photoSortFilter.addEventListener('change', (event) => {
        state.filters.sort = event.target.value;
        resetPhotoRenderWindow();
        loadAdminPhotos(true).catch((error) => showToast(error.message));
    });
    elements.adminSmartFilterToggleButton?.addEventListener('click', () => {
        state.adminSmartFiltersOpen = !state.adminSmartFiltersOpen;
        renderPhotoFilters();
    });
    elements.clearAdminSmartFiltersButton?.addEventListener('click', () => {
        resetAdminSmartFilters();
    });
    [
        ['photoCameraFilter', 'camera'],
        ['photoLensFilter', 'lens'],
        ['photoFocalLengthFilter', 'focalLength'],
        ['photoApertureFilter', 'aperture'],
        ['photoIsoFilter', 'iso'],
        ['photoFormatFilter', 'format']
    ].forEach(([elementKey, filterKey]) => {
        elements[elementKey]?.addEventListener('change', (event) => {
            state.filters[filterKey] = event.target.value;
            resetPhotoRenderWindow();
            loadAdminPhotos(true).catch((error) => showToast(error.message));
        });
    });
}

async function login(event) {
    event.preventDefault();
    const response = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            username: elements.usernameInput.value.trim(),
            password: document.getElementById('passwordInput').value
        })
    }, false);

    state.token = response.data.token;
    localStorage.setItem('photo_live_token', state.token);
    await loadMe();
    await bootDashboard();
    showToast('登录成功');
}

async function loadMe() {
    const response = await api('/auth/me');
    state.user = response.data;
    elements.userName.textContent = `${state.user.nickname} · ${state.user.role}`;
}

async function bootDashboard() {
    toggleScreens(true);
    state.currentView = 'library';
    await Promise.all([
        loadLives(),
        loadUsers()
    ]);
    renderWorkspaceView();
}

async function refreshCurrent() {
    if (state.currentView === 'detail' && state.currentLive?.id) {
        await selectLive(state.currentLive.id);
        return;
    }

    await Promise.all([
        loadLives(),
        loadUsers()
    ]);
    renderLibrary();
}

async function loadLives() {
    state.loadingLibrary = true;
    renderLibrary();
    const response = await api('/lives/admin/list');
    state.lives = response.data;
    state.loadingLibrary = false;
    renderLibrary();
}

async function loadUsers() {
    if (state.user?.role !== 'admin') {
        state.users = [];
        return;
    }

    const response = await api('/auth/users');
    state.users = response.data || [];
}

async function createLiveQuickly(event) {
    event.preventDefault();
    const title = elements.quickTitleInput.value.trim();
    if (!title) {
        showToast('请先填写相册名称');
        return;
    }

    const response = await api('/lives', {
        method: 'POST',
        body: JSON.stringify({
            title,
            event_date: elements.quickDateInput.value || null,
            location_name: elements.quickLocationInput.value.trim(),
            status: 'draft'
        })
    });

    elements.quickCreateForm.reset();
    showToast('相册已创建');
    await loadLives();
    await selectLive(response.data.id);
}

async function createUserAccount(event) {
    event.preventDefault();
    const username = elements.newUsernameInput.value.trim();
    const nickname = elements.newNicknameInput.value.trim();
    const password = elements.newPasswordInput.value;
    const role = elements.newUserRoleInput.value;

    if (!username || !nickname || !password) {
        showToast('请先填写完整的账号信息');
        return;
    }

    await api('/auth/users', {
        method: 'POST',
        body: JSON.stringify({ username, nickname, password, role })
    });

    elements.userForm.reset();
    elements.newUserRoleInput.value = 'photographer';
    showToast('账号已创建');
    await loadUsers();
    renderUserManagement();
}

async function selectLive(liveId) {
    state.loadingDetail = true;
    state.currentView = 'detail';
    state.batchMode = false;
    state.analytics = null;
    state.photoDetails = {};
    state.photoDetailLoading = new Set();
    resetPhotoRenderWindow();
    state.selectedPhotoIds.clear();
    renderWorkspaceView();
    renderDetail();

    const response = await api(`/lives/${liveId}`);
    state.currentLive = response.data;
    state.selectedPhotoId = null;

    const [albumsResponse, logsResponse, analyticsResponse] = await Promise.all([
        api(`/albums/live/${liveId}`),
        api(`/logs/live/${liveId}?limit=50`),
        api(`/analytics/live/${liveId}`)
    ]);

    state.albums = albumsResponse.data;
    state.logs = logsResponse.data.logs;
    state.analytics = analyticsResponse.data;
    await loadAdminPhotos(true);
    fillLiveForm(state.currentLive);
    state.loadingDetail = false;
    renderDetail();
}

async function loadAdminPhotos(reset = false) {
    if (!state.currentLive?.id) {
        return;
    }

    if (reset) {
        state.photoPage = 1;
        state.photoPages = 1;
        state.photoTotal = 0;
        state.photos = [];
        state.photoDetails = {};
        resetPhotoRenderWindow();
    } else if (state.photoLoadingMore || state.photoPage >= state.photoPages) {
        return;
    }

    state.photoLoadingMore = true;
    try {
        const targetPage = reset ? 1 : state.photoPage + 1;
        const params = new URLSearchParams({
            page: String(targetPage),
            limit: '120',
            album_id: state.filters.albumId,
            visibility: state.filters.visibility,
            sort: state.filters.sort,
            keyword: state.filters.keyword
        });
        if (state.filters.camera) params.set('camera', state.filters.camera);
        if (state.filters.lens) params.set('lens', state.filters.lens);
        if (state.filters.focalLength) params.set('focal_length', state.filters.focalLength);
        if (state.filters.aperture) params.set('aperture', state.filters.aperture);
        if (state.filters.iso) params.set('iso', state.filters.iso);
        if (state.filters.format) params.set('format', state.filters.format);

        const response = await api(`/photos/admin/live/${state.currentLive.id}?${params.toString()}`);
        const payload = response.data || {};
        const photos = payload.photos || [];

        state.photoPage = Number(payload.page || targetPage);
        state.photoPages = Number(payload.pages || 1);
        state.photoTotal = Number(payload.total || photos.length);
        state.photos = reset ? photos : state.photos.concat(photos);
        if (reset && photos.length) {
            state.photoRenderCount = Math.min(state.photoRenderChunkSize, photos.length);
        }
        renderPhotoWorkspace();
    } finally {
        state.photoLoadingMore = false;
    }
}

function renderLoggedOut() {
    toggleScreens(false);
    renderLibrary();
}

function renderWorkspaceView() {
    elements.libraryScreen.hidden = state.currentView !== 'library';
    elements.detailScreen.hidden = state.currentView !== 'detail';
    if (state.currentView === 'library') {
        renderLibrary();
        return;
    }
    renderDetail();
}

function renderLibrary() {
    renderLibraryOverview();
    renderLiveCards();
    renderUserManagement();
}

function renderDetail() {
    renderDetailHeader();
    renderMetrics();
    renderAlbums();
    renderUploadAlbums();
    renderPhotoFilters();
    renderPhotoWorkspace();
    renderAnalytics();
    renderLogs();
    renderSectionTabs();
    renderCleanupWidget();
    renderBannerImageSettings();
}

function fillLiveForm(live) {
    elements.liveIdInput.value = live.id || '';
    elements.titleInput.value = live.title || '';
    elements.slugInput.value = live.slug || '';
    elements.subtitleInput.value = live.subtitle || '';
    elements.eventDateInput.value = live.event_date ? toLocalDateTime(live.event_date) : '';
    elements.locationInput.value = live.location_name || '';
    elements.descriptionInput.value = live.description || '';
    elements.statusInput.value = live.status || 'draft';
    elements.coverInput.value = live.cover_image || '';
    elements.bannerInput.value = live.banner_image || '';
    elements.openingInput.value = live.opening_image || '';
    elements.themeInput.value = live.theme_color || '#c76b34';
    elements.layoutModeInput.value = live.layout_mode || 'waterfall';
    elements.watermarkInput.value = live.watermark_text || live.title || '';
    elements.shareLogoInput.value = live.share_logo || '';
    elements.shareTitleInput.value = live.share_title || live.title || '';
    elements.shareDescriptionInput.value = live.share_description || '';
    elements.musicInput.value = live.background_music || '';
    elements.enableShareInput.checked = Number(live.enable_share ?? 1) === 1;
    elements.enableClientLinkCopyInput.checked = Number(live.enable_client_link_copy ?? 0) === 1;
    elements.allowWatermarkedDownloadInput.checked = Number(live.allow_watermarked_download ?? 0) === 1;
    elements.allowOriginalDownloadInput.checked = Number(live.allow_original_download ?? 0) === 1;
    elements.allowBatchDownloadInput.checked = Number(live.allow_batch_download ?? 0) === 1;
    elements.accessCodeInput.value = live.access_code || '';
    elements.watermarkEnabledInput.checked = Number(live.watermark_enabled ?? 0) === 1;
    elements.requireReviewInput.checked = Number(live.require_photo_review ?? 0) === 1;
    elements.guestUploadInput.checked = Number(live.enable_guest_upload ?? 0) === 1;
    elements.showPhotographerInput.checked = Number(live.show_photographer ?? 1) === 1;
    elements.showBannerInput.checked = Number(live.show_banner ?? 0) === 1;
    elements.showOpeningInput.checked = Number(live.show_opening ?? 0) === 1;
    elements.openingDurationInput.value = Number(live.opening_duration || 3);
    state.bannerDraftFile = null;
    if (elements.bannerFileInput) {
        elements.bannerFileInput.value = '';
    }
    state.openingDraftFile = null;
    if (elements.openingFileInput) {
        elements.openingFileInput.value = '';
    }
    renderBannerImageSettings();
    renderOpeningImageSettings();
}

function renderBannerImageSettings() {
    if (!elements.bannerPreviewImage || !elements.bannerPreviewPlaceholder) {
        return;
    }

    const draftUrl = state.bannerDraftFile ? URL.createObjectURL(state.bannerDraftFile) : '';
    const currentUrl = draftUrl || elements.bannerInput.value || elements.coverInput.value || '';
    elements.bannerPreviewImage.src = currentUrl;
    elements.bannerPreviewImage.hidden = !currentUrl;
    elements.bannerPreviewPlaceholder.hidden = Boolean(currentUrl);
    elements.uploadBannerImageButton.disabled = !state.bannerDraftFile;
    elements.clearBannerImageButton.disabled = !currentUrl && !state.bannerDraftFile;
    elements.uploadBannerImageButton.textContent = state.bannerDraftFile ? '上传并设为横幅' : '横幅已同步';

    if (state.bannerDraftPreviewUrl && state.bannerDraftPreviewUrl !== draftUrl) {
        URL.revokeObjectURL(state.bannerDraftPreviewUrl);
    }
    state.bannerDraftPreviewUrl = draftUrl;
}

function renderOpeningImageSettings() {
    if (!elements.openingPreviewImage || !elements.openingPreviewPlaceholder) {
        return;
    }

    const draftUrl = state.openingDraftFile ? URL.createObjectURL(state.openingDraftFile) : '';
    const currentUrl = draftUrl || elements.openingInput.value || '';
    elements.openingPreviewImage.src = currentUrl;
    elements.openingPreviewImage.hidden = !currentUrl;
    elements.openingPreviewPlaceholder.hidden = Boolean(currentUrl);
    elements.uploadOpeningImageButton.disabled = !state.openingDraftFile;
    elements.clearOpeningImageButton.disabled = !currentUrl && !state.openingDraftFile;
    elements.uploadOpeningImageButton.textContent = state.openingDraftFile ? '上传并启用' : '开场封面已同步';

    if (state.openingDraftPreviewUrl && state.openingDraftPreviewUrl !== draftUrl) {
        URL.revokeObjectURL(state.openingDraftPreviewUrl);
    }
    state.openingDraftPreviewUrl = draftUrl;
}

async function handleBannerFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
        return;
    }

    if (!file.type.startsWith('image/')) {
        showToast('请选择图片文件');
        event.target.value = '';
        return;
    }

    if (file.size > 8 * 1024 * 1024) {
        showToast('头图请控制在 8MB 以内');
        event.target.value = '';
        return;
    }

    state.bannerDraftFile = file;
    renderBannerImageSettings();
    showToast('横幅已选中，点击上传并设为横幅');
}

async function handleOpeningFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
        return;
    }

    if (!file.type.startsWith('image/')) {
        showToast('请选择图片文件');
        event.target.value = '';
        return;
    }

    if (file.size > 8 * 1024 * 1024) {
        showToast('开场封面请控制在 8MB 以内');
        event.target.value = '';
        return;
    }

    state.openingDraftFile = file;
    renderOpeningImageSettings();
    showToast('开场封面已选中，点击上传并启用');
}

async function uploadBannerImage() {
    if (!state.currentLive?.id) {
        showToast('请先进入一个相册');
        return;
    }

    if (!state.bannerDraftFile) {
        showToast('请先选择头图');
        return;
    }

    const formData = new FormData();
    formData.set('image', state.bannerDraftFile);

    const response = await uploadFormWithProgress({
        url: `/api/lives/${state.currentLive.id}/banner-image`,
        formData,
        headers: {
            Authorization: `Bearer ${state.token}`
        },
        fileIndex: null,
        fileSize: state.bannerDraftFile.size
    });

    elements.bannerInput.value = response.data.banner_image || '';
    elements.coverInput.value = response.data.cover_image || '';
    state.bannerDraftFile = null;
    if (elements.bannerFileInput) {
        elements.bannerFileInput.value = '';
    }
    showToast('头图已更新');
    await loadLives();
    await selectLive(state.currentLive.id);
}

async function uploadOpeningImage() {
    if (!state.currentLive?.id) {
        showToast('请先进入一个相册');
        return;
    }

    if (!state.openingDraftFile) {
        showToast('请先选择开场封面');
        return;
    }

    const formData = new FormData();
    formData.set('image', state.openingDraftFile);

    const response = await uploadFormWithProgress({
        url: `/api/lives/${state.currentLive.id}/opening-image`,
        formData,
        headers: {
            Authorization: `Bearer ${state.token}`
        },
        fileIndex: null,
        fileSize: state.openingDraftFile.size
    });

    elements.openingInput.value = response.data.opening_image || '';
    state.openingDraftFile = null;
    elements.showOpeningInput.checked = true;
    if (elements.openingFileInput) {
        elements.openingFileInput.value = '';
    }
    renderOpeningImageSettings();
    showToast('开场封面已更新');
    await loadLives();
    await selectLive(state.currentLive.id);
}

async function clearBannerImage() {
    if (!state.currentLive?.id) {
        showToast('请先进入一个相册');
        return;
    }

    elements.bannerInput.value = '';
    elements.coverInput.value = '';
    state.bannerDraftFile = null;
    if (elements.bannerFileInput) {
        elements.bannerFileInput.value = '';
    }
    await api(`/lives/${state.currentLive.id}`, {
        method: 'PUT',
        body: JSON.stringify(collectLivePayload())
    });
    showToast('横幅已清空，前台会自动随机展示');
    await loadLives();
    await selectLive(state.currentLive.id);
}

async function clearOpeningImage() {
    if (!state.currentLive?.id) {
        showToast('请先进入一个相册');
        return;
    }

    elements.openingInput.value = '';
    state.openingDraftFile = null;
    elements.showOpeningInput.checked = false;
    if (elements.openingFileInput) {
        elements.openingFileInput.value = '';
    }
    renderOpeningImageSettings();
    await api(`/lives/${state.currentLive.id}`, {
        method: 'PUT',
        body: JSON.stringify(collectLivePayload())
    });
    showToast('开场封面已清空');
    await loadLives();
    await selectLive(state.currentLive.id);
}

async function saveLive(event) {
    event.preventDefault();
    if (!state.currentLive?.id) {
        showToast('请先从相册总览进入一个相册');
        return;
    }

    await api(`/lives/${state.currentLive.id}`, {
        method: 'PUT',
        body: JSON.stringify(collectLivePayload())
    });

    showToast('相册设置已更新');
    await loadLives();
    await selectLive(state.currentLive.id);
}

function collectLivePayload() {
    return {
        title: elements.titleInput.value.trim(),
        slug: elements.slugInput.value.trim(),
        subtitle: elements.subtitleInput.value.trim(),
        event_date: elements.eventDateInput.value || null,
        location_name: elements.locationInput.value.trim(),
        description: elements.descriptionInput.value.trim(),
        status: elements.statusInput.value,
        cover_image: elements.coverInput.value.trim(),
        banner_image: elements.bannerInput.value.trim(),
        opening_image: elements.openingInput.value.trim(),
        theme_color: '#c76b34',
        layout_mode: 'waterfall',
        watermark_text: elements.watermarkInput.value.trim(),
        share_logo: '',
        watermark_enabled: elements.watermarkEnabledInput.checked ? 1 : 0,
        show_banner: 0,
        show_photographer: elements.showPhotographerInput.checked ? 1 : 0,
        share_title: elements.shareTitleInput.value.trim(),
        share_description: elements.shareDescriptionInput.value.trim(),
        background_music: elements.musicInput.value.trim(),
        enable_share: elements.enableShareInput.checked ? 1 : 0,
        enable_client_link_copy: elements.enableClientLinkCopyInput.checked ? 1 : 0,
        allow_watermarked_download: elements.allowWatermarkedDownloadInput.checked ? 1 : 0,
        allow_original_download: elements.allowOriginalDownloadInput.checked ? 1 : 0,
        allow_batch_download: elements.allowBatchDownloadInput.checked ? 1 : 0,
        access_code: elements.accessCodeInput.value.trim(),
        require_photo_review: elements.requireReviewInput.checked ? 1 : 0,
        enable_guest_upload: elements.guestUploadInput.checked ? 1 : 0,
        show_banner: elements.showBannerInput.checked ? 1 : 0,
        show_opening: elements.showOpeningInput.checked ? 1 : 0,
        opening_duration: Math.min(Math.max(Number(elements.openingDurationInput.value) || 3, 1), 9)
    };
}

async function createAlbum(event) {
    event.preventDefault();
    if (!state.currentLive?.id) {
        showToast('请先进入一个相册');
        return;
    }

    await api('/albums', {
        method: 'POST',
        body: JSON.stringify({
            live_id: state.currentLive.id,
            name: elements.albumNameInput.value.trim(),
            icon: elements.albumIconInput.value.trim() || '📷',
            sort_order: Number(elements.albumSortInput.value) || 0
        })
    });

    elements.albumNameInput.value = '';
    elements.albumIconInput.value = '📷';
    elements.albumSortInput.value = '0';
    showToast('分类已创建');
    await selectLive(state.currentLive.id);
}

async function updateAlbum(albumId) {
    const row = elements.albumList.querySelector(`[data-album-row="${albumId}"]`);
    if (!row) {
        return;
    }

    await api(`/albums/${albumId}`, {
        method: 'PUT',
        body: JSON.stringify({
            name: row.querySelector('[data-album-name]').value.trim(),
            icon: row.querySelector('[data-album-icon]').value.trim() || '📷',
            cover_image: '',
            sort_order: Number(row.querySelector('[data-album-sort]').value) || 0
        })
    });

    showToast('分类已更新');
    await selectLive(state.currentLive.id);
}

async function deleteAlbum(albumId) {
    if (!window.confirm('删除分类后，照片会变成未分类。确定继续？')) {
        return;
    }

    await runDeleteTask({
        title: '删除分类',
        total: 1,
        summary: '正在删除分类并刷新列表',
        worker: async ({ step, advance }) => {
            step('正在删除分类', '正在移除该分类');
            await api(`/albums/${albumId}`, { method: 'DELETE' });
            advance();
        }
    });
    showToast('分类已删除');
    await selectLive(state.currentLive.id);
}

async function uploadPhotos(event) {
    event.preventDefault();
    if (!state.currentLive?.id) {
        showToast('请先进入一个相册');
        return;
    }

    if (!elements.uploadFilesInput.files.length) {
        showToast('请选择照片');
        return;
    }

    const files = Array.from(elements.uploadFilesInput.files);
    const invalidFile = files.find((file) => Number(file.size || 0) > 25 * 1024 * 1024);
    if (invalidFile) {
        showToast(`照片“${invalidFile.name}”超过 25MB，已拒绝上传`);
        return;
    }
    startUploadSession(files);

    try {
        if (state.storageMode === 'qiniu') {
            await uploadPhotosDirectToQiniu(files);
        } else {
            await uploadPhotosViaServer(files);
        }

        finishUploadSession('全部照片上传完成');
        closeUploadComposer();
        elements.uploadFilesInput.value = '';
        elements.uploadTagsInput.value = '';
        elements.uploadTitlePrefixInput.value = '';
        showToast('上传完成');
        await loadLives();
        await selectLive(state.currentLive.id);
    } catch (error) {
        failUploadSession(error.message || '上传失败');
        throw error;
    }
}

function openUploadComposer() {
    if (!state.currentLive?.id) {
        showToast('请先进入一个相册');
        return;
    }

    elements.uploadComposer.hidden = false;
}

function closeUploadComposer() {
    if (state.uploadSession.uploading) {
        return;
    }

    elements.uploadComposer.hidden = true;
}

async function uploadPhotosViaServer(files) {
    state.uploadSession.phase = 'uploading';
    await runLimitedConcurrency(files, SERVER_UPLOAD_CONCURRENCY, async (file, index) => {
        updateUploadItem(index, { status: 'uploading', progress: 0, statusText: '正在上传到服务器' });

        const formData = new FormData();
        formData.set('live_id', String(state.currentLive.id));
        if (elements.uploadAlbumSelect.value) {
            formData.set('album_id', elements.uploadAlbumSelect.value);
        }
        formData.set('title_prefix', elements.uploadTitlePrefixInput.value.trim());
        formData.set('tags', elements.uploadTagsInput.value.trim());
        formData.append('images', file);

        const data = await uploadFormWithProgress({
            url: '/api/photos/upload-batch',
            formData,
            headers: {
                Authorization: `Bearer ${state.token}`
            },
            fileIndex: index,
            fileSize: file.size
        });

        updateUploadItem(index, {
            progress: 100,
            status: 'done',
            statusText: data.message || '上传完成'
        });
        state.uploadSession.registeredCount = state.uploadSession.completedCount + 1;
        incrementUploadCompleted();
    });
}

async function uploadPhotosDirectToQiniu(files) {
    const filesWithHashes = await attachFileHashes(files);
    state.uploadSession.phase = 'hashing';
    elements.uploadStatusText.textContent = '正在校验重复照片';
    const batchCount = Math.max(1, Math.ceil(filesWithHashes.length / DIRECT_UPLOAD_PREPARE_BATCH_SIZE));

    for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
        const start = batchIndex * DIRECT_UPLOAD_PREPARE_BATCH_SIZE;
        const chunk = filesWithHashes.slice(start, start + DIRECT_UPLOAD_PREPARE_BATCH_SIZE);
        elements.uploadStatusText.textContent = `正在获取第 ${batchIndex + 1} / ${batchCount} 批上传配置`;

        const prepare = await api('/photos/direct-upload/prepare', {
            method: 'POST',
            body: JSON.stringify({
                live_id: state.currentLive.id,
                album_id: elements.uploadAlbumSelect.value || null,
                title_prefix: elements.uploadTitlePrefixInput.value.trim(),
                tags: elements.uploadTagsInput.value.trim(),
                files: chunk.map(({ file, fileHash }) => ({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    file_hash: fileHash
                }))
            })
        });

        const pendingComplete = [];
        state.uploadSession.phase = 'uploading';
        await runLimitedConcurrency(chunk, DIRECT_UPLOAD_CONCURRENCY, async (item, offset) => {
            const index = start + offset;
            const { file, fileHash } = item;
            const target = prepare.data.files[offset];
            if (!target) {
                throw new Error(`第 ${index + 1} 张照片未拿到七牛上传配置，请重试`);
            }

            if (target.skipped) {
                updateUploadItem(index, {
                    loaded: file.size,
                    progress: 100,
                    status: 'done',
                    statusText: target.message || '重复照片，已跳过'
                });
                state.uploadSession.registeredCount += 1;
                incrementUploadCompleted();
                return;
            }

            if (target.reused) {
                updateUploadItem(index, {
                    loaded: file.size,
                    progress: 92,
                    status: 'processing',
                    statusText: '云端已有同图，正在登记复用'
                });
                pendingComplete.push({
                    client_ref: String(index),
                    key: '',
                    title: target.title,
                    original_name: file.name,
                    file_size: file.size,
                    file_hash: target.file_hash || fileHash || '',
                    width: null,
                    height: null,
                    reused: true
                });
                return;
            }

            updateUploadItem(index, { status: 'uploading', progress: 0, statusText: '正在直传七牛' });
            const formData = new FormData();
            formData.set('token', target.token);
            formData.set('key', target.key);
            formData.set('file', file);

            await uploadFormWithProgress({
                url: target.upload_url || prepare.data.upload_url,
                formData,
                fileIndex: index,
                fileSize: file.size,
                external: true
            });

            const imageMeta = await readImageFileMeta(file);
            updateUploadItem(index, {
                progress: 92,
                status: 'processing',
                statusText: '已传到七牛，正在登记'
            });
            pendingComplete.push({
                client_ref: String(index),
                key: target.key,
                title: target.title,
                original_name: file.name,
                file_size: file.size,
                file_hash: target.file_hash || fileHash || '',
                width: imageMeta.width,
                height: imageMeta.height,
                reused: false
            });
        });

        if (!pendingComplete.length) {
            continue;
        }

        state.uploadSession.phase = 'registering';
        const result = await api('/photos/direct-upload/complete', {
            method: 'POST',
            body: JSON.stringify({
                live_id: state.currentLive.id,
                album_id: elements.uploadAlbumSelect.value || null,
                title_prefix: elements.uploadTitlePrefixInput.value.trim(),
                tags: elements.uploadTagsInput.value.trim(),
                files: pendingComplete.map((entry) => ({
                    client_ref: entry.client_ref,
                    key: entry.key,
                    title: entry.title,
                    original_name: entry.original_name,
                    file_size: entry.file_size,
                    file_hash: entry.file_hash,
                    width: entry.width,
                    height: entry.height
                }))
            })
        });

        const uploadedByRef = new Map((result.data?.uploaded || []).map((item) => [String(item.client_ref || ''), item]));
        const skippedByRef = new Map((result.data?.skipped || []).map((item) => [String(item.client_ref || ''), item]));

        pendingComplete.forEach((entry) => {
            const ref = String(entry.client_ref);
            const uploaded = uploadedByRef.get(ref);
            const skipped = skippedByRef.get(ref);
            const index = Number(ref);

            if (uploaded) {
                updateUploadItem(index, {
                    progress: 100,
                    status: 'done',
                    statusText: entry.reused ? '云端复用完成' : '上传完成'
                });
                state.uploadSession.registeredCount += 1;
                incrementUploadCompleted();
                return;
            }

            if (skipped) {
                updateUploadItem(index, {
                    progress: 100,
                    status: 'done',
                    statusText: skipped.reason === 'duplicate' ? '重复照片，已跳过' : '已跳过'
                });
                state.uploadSession.registeredCount += 1;
                incrementUploadCompleted();
                return;
            }

            throw new Error(`第 ${index + 1} 张照片登记结果异常，请重试`);
        });
    }
}

async function savePhotoDetails(event) {
    event.preventDefault();
    const photo = getSelectedPhoto();
    if (!photo) {
        showToast('请先选择照片');
        return;
    }

    await api(`/photos/${photo.id}`, {
        method: 'PUT',
        body: JSON.stringify({
            title: elements.editorTitleInput.value.trim(),
            description: elements.editorDescriptionInput.value.trim(),
            tags: elements.editorTagsInput.value.trim(),
            album_id: elements.editorAlbumSelect.value || null,
            is_public: elements.editorVisibilitySelect.value
        })
    });

    showToast('照片信息已更新');
    await selectLive(state.currentLive.id);
    state.selectedPhotoId = photo.id;
    renderPhotoWorkspace();
}

async function deletePhoto(photoId) {
    if (!window.confirm('确定删除这张照片？该操作不可恢复。')) {
        return;
    }

    await createPhotoDeleteJob([photoId], '删除照片');
    showToast('照片已删除');
    state.selectedPhotoId = null;
    state.selectedPhotoIds.delete(photoId);
    await loadLives();
    await selectLive(state.currentLive.id);
}

async function downloadFilteredPhotos() {
    if (!state.currentLive?.id) {
        showToast('请先进入一个相册');
        return;
    }

    const photos = getFilteredPhotos();
    if (!photos.length) {
        showToast('当前没有可打包的照片');
        return;
    }

    const response = await api(`/photos/admin/live/${state.currentLive.id}/download-jobs`, {
        method: 'POST',
        body: JSON.stringify({
            ids: photos.map((item) => item.id)
        })
    });

    await waitForAdminDownloadJob(response.data);
}

async function waitForAdminDownloadJob(job) {
    if (job.status === 'ready' && job.download_url) {
        window.open(job.download_url, '_blank');
        showToast('打包完成，已开始下载');
        return;
    }

    showToast('正在提交七牛云端打包任务');
    const startedAt = Date.now();

    while (Date.now() - startedAt < 120000) {
        await new Promise((resolve) => window.setTimeout(resolve, 1800));
        const response = await api(`/photos/admin/live/${state.currentLive.id}/download-jobs/${job.id}`);
        if (response.data.status === 'ready' && response.data.download_url) {
            window.open(response.data.download_url, '_blank');
            showToast('打包完成，已开始下载');
            return;
        }
        if (response.data.status === 'failed') {
            throw new Error(response.data.error_message || '打包失败');
        }
    }

    throw new Error('打包超时，请稍后重试');
}

function renderLibraryOverview() {
    const totalLives = state.lives.length;
    const visibleLives = state.lives.filter((item) => item.status === 'live').length;
    const totalPhotos = state.lives.reduce((sum, item) => sum + Number(item.photo_total || 0), 0);

    elements.liveCountText.textContent = `${totalLives} 个相册`;
    elements.overviewGrid.innerHTML = [
        { label: '总相册数', value: totalLives },
        { label: '可查看', value: visibleLives },
        { label: '照片总数', value: totalPhotos }
    ].map((item) => `
        <article class="overview-card">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(String(item.value))}</strong>
        </article>
    `).join('');
}

function renderUserManagement() {
    if (!elements.userManagementPanel) {
        return;
    }

    const isAdmin = state.user?.role === 'admin';
    elements.userManagementPanel.hidden = !isAdmin;
    if (!isAdmin) {
        return;
    }

    elements.userList.innerHTML = state.users.length
        ? state.users.map((user) => `
            <article class="account-card">
                <div class="account-card-copy">
                    <strong>${escapeHtml(user.nickname || user.username)}</strong>
                    <span>${escapeHtml(user.username)} · ${escapeHtml(user.role)}</span>
                </div>
                ${user.id === state.user?.id
                    ? '<span class="badge">当前账号</span>'
                    : `<button class="text-button danger-text-button compact-button" type="button" data-delete-user="${user.id}">删除</button>`}
            </article>
        `).join('')
        : '<div class="empty-state">还没有其他账号。</div>';
}

function readImageFileMeta(file) {
    return new Promise((resolve) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            resolve({
                width: image.naturalWidth || null,
                height: image.naturalHeight || null
            });
            URL.revokeObjectURL(objectUrl);
        };

        image.onerror = () => {
            resolve({ width: null, height: null });
            URL.revokeObjectURL(objectUrl);
        };

        image.src = objectUrl;
    });
}

function startUploadSession(files) {
    state.uploadSession.active = true;
    state.uploadSession.uploading = true;
    state.uploadSession.startedAt = Date.now();
    state.uploadSession.totalBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
    state.uploadSession.uploadedBytes = 0;
    state.uploadSession.completedCount = 0;
    state.uploadSession.registeredCount = 0;
    state.uploadSession.phase = 'hashing';
    state.uploadSession.items = files.map((file, index) => ({
        id: `${Date.now()}-${index}`,
        name: file.name,
        size: Number(file.size || 0),
        progress: 0,
        loaded: 0,
        status: 'waiting',
        statusText: '等待上传'
    }));
    renderUploadSession();
}

function closeUploadSession() {
    if (state.uploadSession.uploading) {
        showToast('上传进行中，暂时不能关闭');
        return;
    }
    resetUploadSession();
}

function resetUploadSession() {
    state.uploadSession.active = false;
    state.uploadSession.uploading = false;
    state.uploadSession.startedAt = 0;
    state.uploadSession.totalBytes = 0;
    state.uploadSession.uploadedBytes = 0;
    state.uploadSession.completedCount = 0;
    state.uploadSession.registeredCount = 0;
    state.uploadSession.phase = 'waiting';
    state.uploadSession.items = [];
    renderUploadSession();
}

function incrementUploadCompleted() {
    state.uploadSession.completedCount += 1;
    renderUploadSession();
}

function finishUploadSession(message) {
    state.uploadSession.uploading = false;
    state.uploadSession.uploadedBytes = state.uploadSession.totalBytes;
    state.uploadSession.completedCount = state.uploadSession.items.length;
    state.uploadSession.registeredCount = state.uploadSession.items.length;
    state.uploadSession.phase = 'done';
    elements.uploadStatusText.textContent = message;
    renderUploadSession();
}

function failUploadSession(message) {
    state.uploadSession.uploading = false;
    state.uploadSession.phase = 'failed';
    elements.uploadStatusText.textContent = message;
    renderUploadSession();
}

function updateUploadItem(index, patch) {
    const item = state.uploadSession.items[index];
    if (!item) {
        return;
    }

    Object.assign(item, patch);
    state.uploadSession.uploadedBytes = state.uploadSession.items.reduce((sum, entry) => {
        return sum + Math.min(Number(entry.loaded || 0), Number(entry.size || 0));
    }, 0);
    renderUploadSession();
}

function renderUploadSession() {
    elements.uploadSession.hidden = !state.uploadSession.active;
    if (!state.uploadSession.active) {
        return;
    }

    const total = state.uploadSession.totalBytes || 1;
    const rawPercent = Math.min(100, Math.round((state.uploadSession.uploadedBytes / total) * 100));
    const registerRatio = state.uploadSession.items.length
        ? state.uploadSession.registeredCount / state.uploadSession.items.length
        : 0;
    const percent = (() => {
        if (state.uploadSession.phase === 'hashing') {
            return Math.max(2, Math.min(8, rawPercent));
        }
        if (state.uploadSession.phase === 'uploading') {
            return Math.max(8, Math.min(92, Math.round(rawPercent * 0.92)));
        }
        if (state.uploadSession.phase === 'registering') {
            return Math.max(92, Math.min(99, 92 + Math.round(registerRatio * 7)));
        }
        if (state.uploadSession.phase === 'done') {
            return 100;
        }
        return rawPercent;
    })();
    const elapsedSeconds = state.uploadSession.startedAt ? Math.max(1, Math.round((Date.now() - state.uploadSession.startedAt) / 1000)) : 0;
    const remainingSeconds = percent > 5 && percent < 100
        ? Math.max(1, Math.round((elapsedSeconds / percent) * (100 - percent)))
        : 0;
    const uploadedText = formatBytes(state.uploadSession.uploadedBytes);
    const totalText = formatBytes(state.uploadSession.totalBytes);
    const speedPerSecond = elapsedSeconds > 0
        ? state.uploadSession.uploadedBytes / elapsedSeconds
        : 0;
    const speedText = speedPerSecond > 0 ? `${formatBytes(speedPerSecond)}/s` : '计算中';

    elements.uploadSummaryText.textContent = `已上传 ${uploadedText} / ${totalText} · ${state.uploadSession.completedCount} / ${state.uploadSession.items.length} 张`;
    if (state.uploadSession.uploading) {
        const phaseLabel = {
            hashing: '正在校验重复照片',
            uploading: '正在上传图片',
            registering: `正在登记 ${state.uploadSession.registeredCount} / ${state.uploadSession.items.length}`,
            done: '上传完成'
        }[state.uploadSession.phase] || '正在处理';
        elements.uploadStatusText.textContent = remainingSeconds
            ? `${phaseLabel} · 当前网速 ${speedText} · 约剩 ${formatDuration(remainingSeconds)}`
            : `${phaseLabel} · 当前网速 ${speedText} · 总进度 ${percent}%`;
    } else {
        elements.uploadStatusText.textContent = state.uploadSession.phase === 'done'
            ? `上传完成 · 总上传 ${totalText}`
            : elements.uploadStatusText.textContent;
    }
    elements.uploadTotalProgressBar.style.width = `${percent}%`;
    elements.uploadTotalProgressText.textContent = `${percent}%`;
    elements.closeUploadSessionButton.textContent = state.uploadSession.uploading ? '上传中…' : '关闭';

    elements.uploadFileList.innerHTML = state.uploadSession.items.map((item) => `
        <article class="upload-file-row upload-file-row-${escapeHtml(item.status)}">
            <div class="upload-file-main">
                <strong>${escapeHtml(item.name)}</strong>
                <span>${escapeHtml(item.statusText || '等待上传')}</span>
            </div>
            <div class="upload-file-progress">
                <div class="upload-progress-track small">
                    <div class="upload-progress-fill ${item.status}" style="width: ${Math.min(100, item.progress || 0)}%"></div>
                </div>
                <strong>${Math.min(100, Math.round(item.progress || 0))}%</strong>
            </div>
        </article>
    `).join('');
}

function formatDuration(seconds) {
    const totalSeconds = Math.max(0, Number(seconds || 0));
    if (totalSeconds < 60) {
        return `${totalSeconds} 秒`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const restSeconds = totalSeconds % 60;
    return restSeconds ? `${minutes} 分 ${restSeconds} 秒` : `${minutes} 分钟`;
}

async function startCleanupJob() {
    if (state.cleanupJob && ['queued', 'processing'].includes(state.cleanupJob.status)) {
        state.cleanupWidgetVisible = true;
        elements.cleanupWidget.hidden = false;
        renderCleanupWidget();
        showToast('清理任务进行中');
        pollCleanupJob(state.cleanupJob.id);
        return;
    }

    elements.cleanupDataButton.disabled = true;
    elements.cleanupDataButton.textContent = '准备清理…';

    const response = await api('/maintenance/cleanup-jobs', {
        method: 'POST'
    });

    state.cleanupJob = response.data;
    state.cleanupWidgetVisible = true;
    elements.cleanupWidget.hidden = false;
    renderCleanupWidget();
    showToast('已开始扫描无用数据');
    pollCleanupJob(state.cleanupJob.id);
}

function pollCleanupJob(jobId) {
    window.clearTimeout(state.cleanupPollTimer);

    const tick = async () => {
        try {
            const response = await api(`/maintenance/cleanup-jobs/${jobId}`);
            state.cleanupJob = response.data;
            renderCleanupWidget();

            if (['queued', 'processing'].includes(state.cleanupJob.status)) {
                state.cleanupPollTimer = window.setTimeout(tick, 1600);
                return;
            }

            state.cleanupPollTimer = 0;
            if (state.cleanupJob.status === 'ready') {
                showToast('无用数据清理完成');
            } else if (state.cleanupJob.status === 'failed') {
                showToast(state.cleanupJob.error_message || '清理任务失败');
            }
        } catch (error) {
            state.cleanupPollTimer = 0;
            showToast(error.message || '获取清理进度失败');
            renderCleanupWidget();
        }
    };

    tick().catch((error) => showToast(error.message || '获取清理进度失败'));
}

function renderCleanupWidget() {
    const job = state.cleanupJob;
    const isRunning = Boolean(job && ['queued', 'processing'].includes(job.status));

    elements.cleanupDataButton.disabled = isRunning;
    elements.cleanupDataButton.textContent = isRunning ? '清理进行中…' : '清理无用数据';

    if (!job) {
        elements.cleanupWidget.hidden = true;
        elements.cleanupWidget.classList.remove('is-active', 'is-ready', 'is-failed');
        elements.cleanupPhaseText.textContent = '等待开始';
        elements.cleanupSummaryText.textContent = '准备扫描无用数据';
        elements.cleanupProgressBar.style.width = '0%';
        elements.cleanupProgressText.textContent = '0%';
        elements.cleanupStats.innerHTML = '';
        return;
    }

    elements.cleanupWidget.hidden = !state.cleanupWidgetVisible;
    elements.cleanupWidget.classList.toggle('is-active', isRunning);
    elements.cleanupWidget.classList.toggle('is-ready', job.status === 'ready');
    elements.cleanupWidget.classList.toggle('is-failed', job.status === 'failed');
    elements.cleanupPhaseText.textContent = job.phase || '正在清理';
    elements.cleanupSummaryText.textContent = job.summary || '正在扫描无用数据';
    elements.cleanupProgressBar.style.width = `${Math.max(0, Math.min(100, Number(job.progress || 0)))}%`;
    elements.cleanupProgressText.textContent = `${Math.max(0, Math.min(100, Math.round(Number(job.progress || 0))))}%`;
    elements.cleanupStats.innerHTML = formatCleanupStats(job.stats, job.error_message);
}

function closeCleanupWidget() {
    window.clearTimeout(state.cleanupPollTimer);
    state.cleanupPollTimer = 0;
    state.cleanupWidgetVisible = false;
    elements.cleanupWidget.hidden = true;
}

function startDeleteTask({ title, total, summary }) {
    state.deleteTask = {
        active: true,
        running: true,
        phase: title || '删除任务',
        title: title || '删除任务',
        summary: summary || '正在删除内容',
        total: Math.max(1, Number(total || 1)),
        completed: 0,
        errors: []
    };
    renderDeleteWidget();
}

function updateDeleteTask({ phase, summary, completed, error }) {
    if (!state.deleteTask.active) {
        return;
    }
    if (phase) {
        state.deleteTask.phase = phase;
    }
    if (summary) {
        state.deleteTask.summary = summary;
    }
    if (Number.isFinite(completed)) {
        state.deleteTask.completed = Math.max(0, Math.min(state.deleteTask.total, completed));
    }
    if (error) {
        state.deleteTask.errors.push(String(error));
    }
    renderDeleteWidget();
}

function finishDeleteTask(summary = '删除完成') {
    if (!state.deleteTask.active) {
        return;
    }
    state.deleteTask.running = false;
    state.deleteTask.phase = '删除完成';
    state.deleteTask.summary = summary;
    state.deleteTask.completed = state.deleteTask.total;
    renderDeleteWidget();
}

function failDeleteTask(message) {
    if (!state.deleteTask.active) {
        return;
    }
    state.deleteTask.running = false;
    state.deleteTask.phase = '删除失败';
    state.deleteTask.summary = message || '删除失败';
    if (message) {
        state.deleteTask.errors.push(String(message));
    }
    renderDeleteWidget();
}

function closeDeleteWidget() {
    if (state.deleteTask.running) {
        showToast('删除进行中，暂时不能关闭');
        return;
    }
    window.clearTimeout(state.deleteTaskPollTimer);
    state.deleteTaskPollTimer = 0;
    state.deleteTask = {
        active: false,
        running: false,
        phase: 'waiting',
        title: '',
        summary: '',
        total: 0,
        completed: 0,
        errors: []
    };
    renderDeleteWidget();
}

function renderDeleteWidget() {
    if (!elements.deleteWidget) {
        return;
    }

    const task = state.deleteTask;
    elements.deleteWidget.hidden = !task.active;
    if (!task.active) {
        return;
    }

    const percent = task.total ? Math.max(0, Math.min(100, Math.round((task.completed / task.total) * 100))) : 0;
    elements.deletePhaseText.textContent = task.phase || task.title || '删除任务';
    elements.deleteSummaryText.textContent = task.summary || '正在删除内容';
    elements.deleteProgressBar.style.width = `${percent}%`;
    elements.deleteProgressText.textContent = `${percent}%`;
    elements.closeDeleteWidgetButton.textContent = task.running ? '删除中…' : '关闭';
    elements.deleteWidget.classList.toggle('is-active', task.running);
    elements.deleteWidget.classList.toggle('is-ready', !task.running && !task.errors.length);
    elements.deleteWidget.classList.toggle('is-failed', !task.running && task.errors.length > 0);
    elements.deleteStats.innerHTML = [
        ['总数', task.total],
        ['已完成', task.completed],
        ['剩余', Math.max(0, task.total - task.completed)],
        ['错误', task.errors.length]
    ].map(([label, value]) => `
        <article class="cleanup-stat-card ${label === '错误' && Number(value) ? 'cleanup-stat-card-error' : ''}">
            <span>${escapeHtml(String(label))}</span>
            <strong>${escapeHtml(String(value))}</strong>
        </article>
    `).join('');
}

async function runDeleteTask({ title, total, summary, worker }) {
    startDeleteTask({ title, total, summary });

    const helpers = {
        step: (phase, nextSummary) => updateDeleteTask({ phase, summary: nextSummary }),
        advance: () => updateDeleteTask({ completed: state.deleteTask.completed + 1 }),
        fail: (itemName, message) => updateDeleteTask({ error: `${itemName}: ${message}` })
    };

    try {
        await worker(helpers);
        finishDeleteTask('删除完成');
    } catch (error) {
        failDeleteTask(error.message || '删除失败');
        throw error;
    }
}

async function createPhotoDeleteJob(ids, title = '删除照片') {
    const response = await api('/maintenance/photo-delete-jobs', {
        method: 'POST',
        body: JSON.stringify({
            live_id: state.currentLive.id,
            ids
        })
    });

    applyDeleteJobState(response.data, title);
    await pollDeletePhotoJob(response.data.id, title);
}

function applyDeleteJobState(job, title = '删除任务') {
    const stats = job?.stats || {};
    state.deleteTask.active = true;
    state.deleteTask.running = ['queued', 'processing'].includes(job?.status);
    state.deleteTask.phase = job?.phase || title;
    state.deleteTask.title = title;
    state.deleteTask.summary = job?.summary || '';
    state.deleteTask.total = Number(stats.total || 0);
    state.deleteTask.completed = Number(stats.deleted_count || 0);
    state.deleteTask.errors = Number(stats.failed_count || 0)
        ? [`失败 ${stats.failed_count} 项`]
        : [];
    renderDeleteWidget();
}

async function pollDeletePhotoJob(jobId, title = '删除任务') {
    window.clearTimeout(state.deleteTaskPollTimer);

    while (true) {
        const response = await api(`/maintenance/photo-delete-jobs/${jobId}`);
        applyDeleteJobState(response.data, title);
        if (!['queued', 'processing'].includes(response.data.status)) {
            state.deleteTaskPollTimer = 0;
            return;
        }
        await new Promise((resolve) => {
            state.deleteTaskPollTimer = window.setTimeout(resolve, 1200);
        });
    }
}

async function runLimitedConcurrency(items, limit, worker) {
    const list = Array.from(items || []);
    const concurrency = Math.max(1, Math.min(Number(limit || 1), list.length || 1));
    let cursor = 0;

    const runners = Array.from({ length: concurrency }).map(async () => {
        while (cursor < list.length) {
            const index = cursor;
            cursor += 1;
            await worker(list[index], index);
        }
    });

    await Promise.all(runners);
}

function formatCleanupStats(stats = {}, errorMessage = '') {
    const items = [
        ['已引用文件', Number(stats.referenced_keys || 0)],
        ['扫描到的云端文件', Number(stats.scanned_keys || 0)],
        ['无引用文件', Number(stats.orphan_keys || 0)],
        ['已清理云端文件', Number(stats.deleted_keys || 0)],
        ['清理下载记录', Number(stats.expired_download_jobs_cleared || 0)],
        ['清理临时文件', Number(stats.stale_temp_files_deleted || 0)]
    ];

    const cards = items.map(([label, value]) => `
        <article class="cleanup-stat-card">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(String(value))}</strong>
        </article>
    `).join('');

    if (!errorMessage) {
        return cards;
    }

    return `${cards}
        <article class="cleanup-stat-card cleanup-stat-card-error">
            <span>错误信息</span>
            <strong>${escapeHtml(errorMessage)}</strong>
        </article>
    `;
}

function uploadFormWithProgress({ url, formData, headers = {}, fileIndex, fileSize, external = false }) {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('POST', url, true);

        Object.entries(headers).forEach(([key, value]) => {
            request.setRequestHeader(key, value);
        });

        request.upload.addEventListener('progress', (event) => {
            if (!event.lengthComputable) {
                return;
            }
            const progress = Math.min(100, (event.loaded / event.total) * 100);
            if (Number.isInteger(fileIndex)) {
                updateUploadItem(fileIndex, {
                    loaded: Math.round((progress / 100) * fileSize),
                    progress,
                    status: 'uploading',
                    statusText: external ? '正在传到七牛' : '正在上传到服务器'
                });
            }
        });

        request.onload = () => {
            const body = safeJsonParse(request.responseText, {});
            if (request.status >= 200 && request.status < 300) {
                if (Number.isInteger(fileIndex)) {
                    updateUploadItem(fileIndex, {
                        loaded: fileSize,
                        progress: 100
                    });
                }
                resolve(body);
                return;
            }

            reject(new Error(body.error || body.message || '上传失败'));
        };

        request.onerror = () => reject(new Error('上传过程中网络中断'));
        request.send(formData);
    });
}

function renderLiveCards() {
    if (state.loadingLibrary) {
        elements.liveList.innerHTML = skeletonCards(4);
        return;
    }

    elements.liveList.innerHTML = state.lives.length
        ? state.lives.map((live) => `
            <article class="album-card" data-live-id="${live.id}">
                <div class="album-card-head">
                    <span class="album-card-badge">${escapeHtml(formatStatus(live.status))}</span>
                    <strong>${escapeHtml(live.title)}</strong>
                </div>
                <p>${escapeHtml(live.location_name || '未填写地点')}</p>
                <div class="album-card-meta">
                    <span>${escapeHtml(formatDateOnly(live.event_date))}</span>
                    <span>${live.photo_total || 0} 张照片</span>
                </div>
                <div class="album-card-actions">
                    <button class="secondary-button" type="button">进入管理</button>
                    <button class="text-button danger-text-button" type="button" data-delete-live="${live.id}">删除相册</button>
                </div>
            </article>
        `).join('')
        : '<div class="empty-state">还没有客户相册，先新建一个。</div>';
}

async function deleteLive(liveId) {
    const live = state.lives.find((item) => item.id === Number(liveId));
    if (!live) {
        showToast('相册不存在');
        return;
    }

    const confirmed = window.confirm(`确定删除相册「${live.title}」吗？该相册下的照片记录也会一起删除。若图片被其他相册复用，云端文件不会误删。`);
    if (!confirmed) {
        return;
    }

    await runDeleteTask({
        title: '删除相册',
        total: 1,
        summary: '正在删除相册和关联照片记录',
        worker: async ({ step, advance }) => {
            step('正在删除相册', `正在删除「${live.title}」及其照片记录`);
            await api(`/lives/${live.id}`, { method: 'DELETE' });
            advance();
        }
    });
    showToast('相册已删除');

    if (state.currentLive?.id === live.id) {
        state.currentLive = null;
        state.currentView = 'library';
    }

    await loadLives();
    renderWorkspaceView();
}

async function deleteUserAccount(userId) {
    const user = state.users.find((item) => item.id === Number(userId));
    if (!user) {
        showToast('账号不存在');
        return;
    }

    const confirmed = window.confirm(`确定删除账号「${user.nickname || user.username}」吗？该账号参与的相册成员关系也会一起移除。`);
    if (!confirmed) {
        return;
    }

    await api(`/auth/users/${user.id}`, { method: 'DELETE' });
    showToast('账号已删除');
    await loadUsers();
    renderUserManagement();
}

function renderDetailHeader() {
    if (state.loadingDetail) {
        elements.heroTitle.innerHTML = '<span class="skeleton skeleton-xl"></span>';
        elements.heroSummary.innerHTML = '<span class="skeleton skeleton-line"></span>';
        elements.shareLinkInput.value = '';
        elements.shareTips.textContent = '正在载入相册信息...';
        return;
    }

    if (!state.currentLive?.title) {
        elements.heroTitle.textContent = '请选择一个相册';
        elements.heroSummary.textContent = '从相册总览进入某个相册后，这里会显示当前相册的管理信息。';
        elements.previewLink.href = '#';
        elements.shareLinkInput.value = '';
        elements.shareTips.textContent = '进入相册后会显示客户观看链接。';
        return;
    }

    elements.heroTitle.textContent = state.currentLive.title;
    elements.heroSummary.textContent = `${formatDateOnly(state.currentLive.event_date)} · ${state.currentLive.location_name || '未填写地点'} · ${state.currentLive.description || '在这个相册里管理照片、分类和客户查看设置。'}`;
    elements.previewLink.href = `/live/${state.currentLive.slug}`;
    elements.shareLinkInput.value = `${window.location.origin}/live/${state.currentLive.slug}`;
    elements.shareTips.textContent = state.currentLive.access_code
        ? `当前相册已设置访问密码：${state.currentLive.access_code}`
        : '当前相册无需访问密码，客户可以直接访问。';
}

function renderMetrics() {
    if (state.loadingDetail) {
        elements.metricGrid.innerHTML = Array.from({ length: 4 }).map(() => `
            <article class="metric-card skeleton-card">
                <div class="skeleton skeleton-line short"></div>
                <div class="skeleton skeleton-xl"></div>
            </article>
        `).join('');
        return;
    }

    const stats = getLiveStats();
    const analyticsSummary = state.analytics?.summary || {};
    elements.metricGrid.innerHTML = [
        { label: '照片数量', value: stats.photoCount, note: '当前相册已上传' },
        { label: '分类数量', value: stats.albumCount, note: '相册内部分类' },
        { label: '总浏览', value: stats.views, note: '客户累计浏览' },
        { label: '总点赞', value: stats.likes, note: '客户互动数据' },
        { label: '独立访客', value: analyticsSummary.unique_visitors || 0, note: '同设备去重后统计' },
        { label: '主要设备', value: analyticsSummary.top_device || '暂无', note: '客户最常用查看设备' },
        { label: '主要地区', value: analyticsSummary.top_location || '暂无', note: '按访问记录自动识别' },
        { label: '热门照片', value: analyticsSummary.top_photo || '暂无', note: '当前相册浏览量第一' }
    ].map((card) => `
        <article class="metric-card">
            <span>${escapeHtml(card.label)}</span>
            <strong>${escapeHtml(String(card.value))}</strong>
            <div class="hint small">${escapeHtml(card.note)}</div>
        </article>
        `).join('');
}

function renderAnalytics() {
    if (!elements.analyticsSummaryGrid) {
        return;
    }

    if (state.loadingDetail) {
        const skeleton = Array.from({ length: 4 }).map(() => `
            <article class="metric-card skeleton-card">
                <div class="skeleton skeleton-line short"></div>
                <div class="skeleton skeleton-xl"></div>
            </article>
        `).join('');
        elements.analyticsSummaryGrid.innerHTML = skeleton;
        elements.analyticsTopPhotos.innerHTML = skeletonList(3);
        elements.analyticsTopAlbums.innerHTML = skeletonList(4);
        elements.analyticsDevices.innerHTML = skeletonList(4);
        elements.analyticsLocations.innerHTML = skeletonList(4);
        elements.analyticsRecentVisitors.innerHTML = skeletonList(4);
        return;
    }

    const analytics = state.analytics || {};
    const summary = analytics.summary || {};
    elements.analyticsSummaryGrid.innerHTML = [
        { label: '独立访客', value: summary.unique_visitors || 0, note: '按 IP + 设备指纹去重' },
        { label: '独立 IP', value: summary.unique_ips || 0, note: '最近累计访问来源' },
        { label: '平均停留', value: summary.average_duration_seconds ? formatDuration(summary.average_duration_seconds) : '暂无数据', note: '已完成会话的平均停留时长' },
        { label: '下载次数', value: summary.total_downloads || 0, note: '客户触发原图下载累计次数' },
        { label: '最热分类', value: summary.top_album || '暂无数据', note: '按分类累计浏览量' },
        { label: '最后访问', value: summary.last_visit_at ? formatDateTime(summary.last_visit_at) : '暂无数据', note: '最近一次客户打开时间' }
    ].map((card) => `
        <article class="metric-card">
            <span>${escapeHtml(card.label)}</span>
            <strong>${escapeHtml(String(card.value))}</strong>
            <div class="hint small">${escapeHtml(card.note)}</div>
        </article>
    `).join('');

    elements.analyticsTopPhotos.innerHTML = analytics.top_photos?.length
        ? analytics.top_photos.map((photo) => `
            <article class="analytics-photo-item">
                <img src="${photo.thumbnail_url}" alt="${escapeHtml(photo.title || '照片')}">
                <div>
                    <strong>${escapeHtml(photo.title || photo.original_name || '未命名照片')}</strong>
                    <span>${photo.view_count || 0} 次浏览 · ${photo.like_count || 0} 个点赞 · ${photo.download_count || 0} 次下载</span>
                </div>
            </article>
        `).join('')
        : '<div class="empty-state">还没有可用的照片观看数据。</div>';

    elements.analyticsTopAlbums.innerHTML = renderAnalyticsList(
        analytics.top_albums,
        (item) => `${item.icon || '📷'} ${item.name || '未分类'}`,
        (item) => `${item.total_views || 0} 次浏览 · ${item.photo_count || 0} 张照片`
    );
    elements.analyticsDevices.innerHTML = renderAnalyticsList(
        analytics.devices,
        (item) => item.label || '未知设备',
        (item) => `${item.total_events || 0} 次访问 · ${item.unique_visitors || 0} 位访客`
    );
    elements.analyticsLocations.innerHTML = renderAnalyticsList(
        analytics.locations,
        (item) => item.label || '未识别地区',
        (item) => `${item.total_events || 0} 次访问 · ${item.unique_ips || 0} 个 IP`
    );
    elements.analyticsRecentVisitors.innerHTML = analytics.recent_visitors?.length
        ? analytics.recent_visitors.map((item) => `
            <article class="analytics-visitor-item">
                <div class="analytics-visitor-main">
                    <strong>${escapeHtml(item.ip_display || '未知 IP')}</strong>
                    <span>${escapeHtml(item.location_label || '未识别地区')}</span>
                </div>
                <div class="analytics-visitor-meta">
                    <span>${escapeHtml(item.device_name || item.device_type || '未知设备')}</span>
                    <span>${escapeHtml(item.browser_name || '未知浏览器')}</span>
                    <span>${escapeHtml(item.os_name || '未知系统')}</span>
                    <span>${escapeHtml(formatDateTime(item.created_at))}</span>
                </div>
            </article>
        `).join('')
        : '<div class="empty-state">还没有客户访问记录。</div>';
}

function renderAnalyticsList(items, titleGetter, noteGetter) {
    if (!items?.length) {
        return '<div class="empty-state">还没有可用数据。</div>';
    }

    return items.map((item) => `
        <article class="analytics-list-item">
            <strong>${escapeHtml(titleGetter(item))}</strong>
            <span>${escapeHtml(noteGetter(item))}</span>
        </article>
    `).join('');
}

function renderAlbums() {
    if (state.loadingDetail) {
        elements.albumList.innerHTML = skeletonList(3);
        return;
    }

    elements.albumList.innerHTML = state.albums.length
        ? state.albums.map((album) => `
            <div class="album-pill-editor" data-album-row="${album.id}">
                <div class="album-pill-head">
                    <strong>${escapeHtml(album.icon || '📷')} ${escapeHtml(album.name)}</strong>
                    <span>${album.photo_count || 0} 张</span>
                </div>
                <div class="album-pill-fields">
                    <input data-album-name type="text" value="${escapeHtml(album.name)}" placeholder="分类名称">
                    <input data-album-icon type="text" value="${escapeHtml(album.icon || '📷')}" placeholder="图标">
                    <input data-album-sort type="number" value="${album.sort_order || 0}" placeholder="排序">
                </div>
                <div class="album-pill-actions">
                    <button class="secondary-button compact-button" type="button" data-save-album="${album.id}">保存</button>
                    <button class="text-button compact-button" type="button" data-delete-album="${album.id}">删除</button>
                </div>
            </div>
        `).join('')
        : '<div class="empty-state">还没有分类，先新建一个。</div>';
}

function renderUploadAlbums() {
    const options = ['<option value="">未分类</option>'].concat(
        state.albums.map((album) => `<option value="${album.id}">${escapeHtml(album.icon || '📷')} ${escapeHtml(album.name)}</option>`)
    );
    const html = options.join('');
    elements.uploadAlbumSelect.innerHTML = html;
    elements.editorAlbumSelect.innerHTML = html;
    elements.batchEditorAlbumSelect.innerHTML = html;
}

function renderPhotoFilters() {
    const options = ['<option value="all">全部分类</option>'].concat(
        state.albums.map((album) => `<option value="${album.id}">${escapeHtml(album.icon || '📷')} ${escapeHtml(album.name)}</option>`)
    );
    elements.photoAlbumFilter.innerHTML = options.join('');
    elements.photoAlbumFilter.value = state.filters.albumId;
    elements.photoVisibilityFilter.value = state.filters.visibility;
    elements.photoSortFilter.value = state.filters.sort;
    renderAdminSmartFilters();
    renderPhotoCount();
}

function renderAdminSmartFilters() {
    const options = buildAdminSmartFilterOptions();
    renderSelectOptions(elements.photoCameraFilter, options.cameras, state.filters.camera, '全部机身');
    renderSelectOptions(elements.photoLensFilter, options.lenses, state.filters.lens, '全部镜头');
    renderSelectOptions(elements.photoFocalLengthFilter, options.focalLengths, state.filters.focalLength, '全部焦段');
    renderSelectOptions(elements.photoApertureFilter, options.apertures, state.filters.aperture, '全部光圈');
    renderSelectOptions(elements.photoIsoFilter, options.isoValues, state.filters.iso, '全部 ISO');
    renderSelectOptions(elements.photoFormatFilter, options.formats, state.filters.format, '全部格式');
    elements.adminSmartFilterToggleButton.classList.toggle('active', state.adminSmartFiltersOpen);
    elements.adminSmartFilters.hidden = !state.adminSmartFiltersOpen || !hasAdminSmartFilters(options);
}

function renderSelectOptions(element, values, currentValue, allLabel) {
    if (!element) {
        return;
    }
    const html = ['<option value="">' + escapeHtml(allLabel) + '</option>'].concat(
        values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    );
    element.innerHTML = html.join('');
    element.value = currentValue || '';
}

function buildAdminSmartFilterOptions() {
    const sets = {
        cameras: new Set(),
        lenses: new Set(),
        focalLengths: new Set(),
        apertures: new Set(),
        isoValues: new Set(),
        formats: new Set()
    };

    state.photos.forEach((photo) => {
        const exif = photo.exif_data || {};
        if (photo.camera_search || exif.camera || exif.Model || exif.Make) {
            sets.cameras.add(String(exif.camera || exif.Model || exif.Make || photo.camera_search || '').trim());
        }
        if (photo.lens_search || exif.lens || exif.LensModel) {
            sets.lenses.add(String(exif.lens || exif.LensModel || photo.lens_search || '').trim());
        }
        if (photo.focal_length_search || exif.focalLength) {
            sets.focalLengths.add(String(exif.focalLength || photo.focal_length_search || '').trim());
        }
        if (photo.aperture_search || exif.aperture) {
            sets.apertures.add(String(exif.aperture || photo.aperture_search || '').trim());
        }
        if (photo.iso_value || exif.iso) {
            sets.isoValues.add(String(exif.iso || photo.iso_value || '').trim());
        }
        if (photo.format_value || exif.format) {
            sets.formats.add(String(exif.format || photo.format_value || '').trim().toUpperCase());
        }
    });

    return {
        cameras: sortSmartFilterValues(sets.cameras),
        lenses: sortSmartFilterValues(sets.lenses),
        focalLengths: sortSmartFilterValues(sets.focalLengths),
        apertures: sortSmartFilterValues(sets.apertures),
        isoValues: sortSmartFilterValues(sets.isoValues),
        formats: sortSmartFilterValues(sets.formats)
    };
}

function sortSmartFilterValues(set) {
    return Array.from(set).filter(Boolean).sort((left, right) => String(left).localeCompare(String(right), 'zh-CN', { numeric: true }));
}

function hasAdminSmartFilters(options) {
    return Object.values(options).some((items) => items.length > 0);
}

function renderPhotoCount() {
    const filtered = getFilteredPhotos();
    const selectedCount = getSelectedPhotos().length;
    const shownCount = Math.min(filtered.length, state.photoRenderCount || filtered.length);
    const totalCount = state.photoTotal || filtered.length;
    elements.photoCountText.textContent = state.batchMode
        ? `已选 ${selectedCount} 张 · 已加载 ${filtered.length} / 共 ${totalCount} 张`
        : `已显示 ${shownCount} / 已加载 ${filtered.length} / 共 ${totalCount} 张照片`;
}

function renderPhotoWorkspace() {
    renderPhotoCount();
    renderBatchToolbar();
    renderPhotoGallery();
    renderPhotoInspector();
}

function renderBatchToolbar() {
    elements.batchToolbar.hidden = !state.batchMode;
    elements.toggleBatchModeButton.textContent = state.batchMode ? '退出批量' : '批量管理';
    elements.batchSelectionText.textContent = `已选择 ${getSelectedPhotos().length} 张照片`;
}

function renderPhotoGallery() {
    if (state.loadingDetail) {
        elements.photoGallery.innerHTML = Array.from({ length: 6 }).map(() => `
            <article class="photo-card skeleton-card">
                <div class="skeleton skeleton-photo"></div>
                <div class="photo-card-body">
                    <div class="skeleton skeleton-line"></div>
                    <div class="skeleton skeleton-line short"></div>
                </div>
            </article>
        `).join('');
        elements.photoGallerySentinel.hidden = true;
        return;
    }

    const photos = getFilteredPhotos();
    if (!state.photoRenderCount) {
        state.photoRenderCount = Math.min(state.photoRenderChunkSize, photos.length);
    } else {
        state.photoRenderCount = Math.min(state.photoRenderCount, photos.length || state.photoRenderCount);
    }
    const visiblePhotos = photos.slice(0, state.photoRenderCount);
    const uploadTile = state.currentLive ? `
        <article class="photo-card photo-card-upload" data-open-upload="1">
            <div class="photo-upload-tile">
                <strong>＋</strong>
                <span>上传照片</span>
                <small>点这里直接打开上传面板</small>
            </div>
        </article>
    ` : '';

    elements.photoGallery.innerHTML = (photos.length || uploadTile)
        ? `${uploadTile}${visiblePhotos.map((photo) => `
            <article class="photo-card ${state.selectedPhotoId === photo.id ? 'active' : ''} ${state.selectedPhotoIds.has(photo.id) ? 'selected' : ''} ${state.batchMode ? 'batch-mode' : ''}" data-photo-id="${photo.id}">
                <div class="photo-card-check">${state.selectedPhotoIds.has(photo.id) ? '✓' : ''}</div>
                <img src="${buildAdminGalleryThumbSrc(photo)}" loading="lazy" decoding="async" fetchpriority="low" alt="${escapeHtml(photo.title || photo.original_name || '照片')}">
                <div class="photo-card-body">
                    <div class="photo-card-head">
                        <strong>${escapeHtml(photo.title || photo.original_name || '未命名照片')}</strong>
                        <span class="visibility-pill ${Number(photo.is_public) === 1 ? 'public' : 'private'}">
                            ${Number(photo.is_public) === 1 ? '显示' : '隐藏'}
                        </span>
                    </div>
                    <div class="photo-card-meta">
                        <span class="badge">${escapeHtml(photo.album_name || '未分类')}</span>
                        <span>${escapeHtml(formatDateTime(photo.created_at))}</span>
                    </div>
                    <div class="photo-card-actions">
                        <button class="text-button compact-button" type="button" data-manage-photo="${photo.id}">管理这张</button>
                    </div>
                </div>
            </article>
        `).join('')}`
        : '<div class="empty-state">当前筛选条件下没有照片。</div>';

    if (!photos.length) {
        elements.photoGallerySentinel.hidden = true;
    } else {
        const hasMoreRemote = state.photoPage < state.photoPages;
        const hasMoreLocal = visiblePhotos.length < photos.length;
        elements.photoGallerySentinel.hidden = !hasMoreRemote && !hasMoreLocal;
        elements.photoGallerySentinel.textContent = state.photoLoadingMore
            ? '正在加载更多照片…'
            : hasMoreRemote
                ? `已加载 ${photos.length} / ${state.photoTotal} 张，继续下滑加载更多`
                : '继续下滑加载剩余照片';
    }
    ensurePhotoGalleryObserver();
}

function syncPhotoSelectionState() {
    if (!elements.photoGallery) {
        return;
    }

    elements.photoGallery.querySelectorAll('[data-photo-id]').forEach((card) => {
        const photoId = Number(card.dataset.photoId);
        const isActive = state.selectedPhotoId === photoId;
        const isSelected = state.selectedPhotoIds.has(photoId);
        card.classList.toggle('active', isActive);
        card.classList.toggle('selected', isSelected);
        card.classList.toggle('batch-mode', state.batchMode);
        const check = card.querySelector('.photo-card-check');
        if (check) {
            check.textContent = isSelected ? '✓' : '';
        }
    });
}

function renderPhotoInspector() {
    if (state.loadingDetail) {
        elements.photoInspectorEmpty.hidden = false;
        elements.photoBatchInspector.hidden = true;
        elements.photoInspectorContent.hidden = true;
        elements.photoInspectorEmpty.innerHTML = `
            <div class="skeleton skeleton-photo"></div>
            <div class="skeleton skeleton-line"></div>
            <div class="skeleton skeleton-line short"></div>
        `;
        return;
    }

    const selectedPhotos = getSelectedPhotos();
    if (state.batchMode && selectedPhotos.length) {
        elements.photoInspectorEmpty.hidden = true;
        elements.photoInspectorContent.hidden = true;
        elements.photoBatchInspector.hidden = false;
        renderBatchInspector(selectedPhotos);
        return;
    }

    const photo = getSelectedPhoto();
    if (!photo) {
        elements.photoInspectorEmpty.hidden = false;
        elements.photoBatchInspector.hidden = true;
        elements.photoInspectorContent.hidden = true;
        elements.photoInspectorEmpty.innerHTML = `
            <strong>${state.batchMode ? '当前为批量模式' : '选择一张照片'}</strong>
            <p>${state.batchMode ? '左侧可以勾选多张照片统一处理；如果要编辑单张照片，点击卡片里的“管理这张”。' : '右侧可以修改标题、标签、所属分类和客户可见状态。'}</p>
        `;
        return;
    }

    elements.photoInspectorEmpty.hidden = true;
    elements.photoBatchInspector.hidden = true;
    elements.photoInspectorContent.hidden = false;
    pulseInspector();
    renderInspectorPreview(photo);
    elements.editorTitleInput.value = photo.title || '';
    elements.editorDescriptionInput.value = photo.description || '';
    elements.editorTagsInput.value = (photo.tags || []).join(', ');
    elements.editorAlbumSelect.value = photo.album_id || '';
    elements.editorVisibilitySelect.value = String(Number(photo.is_public ?? 1));
    elements.editorOriginalLink.href = photo.original_url || '#';

    const exif = photo.exif_data || {};
    const sizeText = photo.width && photo.height ? `${photo.width} × ${photo.height}` : '未识别尺寸';
    const deviceText = exif.camera || exif.Model || exif.Make || photo.camera_search || '正在加载设备信息';
    const settingsText = [
        exif.aperture,
        exif.shutterSpeed,
        exif.iso ? `ISO ${exif.iso}` : '',
        photo.focal_length_search || ''
    ].filter(Boolean).join(' / ') || '正在加载拍摄参数';
    const metaItems = [
        ['所属相册', state.currentLive?.title || '-'],
        ['所属分类', photo.album_name || '未分类'],
        ['原始文件名', photo.original_name || '未记录'],
        ['摄影师', photo.photographer_name || '官方摄影'],
        ['上传时间', formatDateTime(photo.created_at)],
        ['尺寸', sizeText],
        ['浏览 / 点赞', `${photo.view_count || 0} / ${photo.like_count || 0}`],
        ['设备信息', deviceText],
        ['拍摄参数', settingsText]
    ];
    elements.editorMeta.innerHTML = metaItems.map(([label, value]) => `
        <div>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
        </div>
    `).join('');
}

function renderInspectorPreview(photo) {
    const previewSrc = buildAdminGalleryThumbSrc(photo);
    const sharpSrc = photo.compressed_url || photo.watermarked_url || photo.original_url || previewSrc;
    const image = elements.editorPreviewImage;

    window.clearTimeout(state.inspectorPreviewUpgradeTimer);
    image.src = previewSrc;

    if (!sharpSrc || sharpSrc === previewSrc) {
        return;
    }

    state.inspectorPreviewUpgradeTimer = window.setTimeout(() => {
        const loader = new Image();
        loader.decoding = 'async';
        loader.onload = () => {
            if (getSelectedPhoto()?.id === photo.id) {
                image.src = sharpSrc;
            }
        };
        loader.src = sharpSrc;
    }, 40);
}

function renderBatchInspector(photos) {
    const previewItems = photos.slice(0, 4);
    const totalSize = photos.reduce((sum, photo) => sum + Number(photo.file_size || 0), 0);
    const visibleCount = photos.filter((photo) => Number(photo.is_public) === 1).length;
    const hiddenCount = photos.length - visibleCount;

    elements.batchInspectorStack.innerHTML = `
        <div class="batch-stack-visual">
            ${previewItems.map((photo, index) => `
                <div class="batch-stack-card batch-stack-card-${index}">
                    <img src="${photo.thumbnail_url}" alt="${escapeHtml(photo.title || '照片')}">
                </div>
            `).join('')}
            <div class="batch-stack-count">${photos.length} 张</div>
        </div>
    `;

    elements.batchInspectorMeta.innerHTML = [
        ['已选照片', `${photos.length} 张`],
        ['预计大小', formatBytes(totalSize)],
        ['当前显示', `${visibleCount} 张`],
        ['当前隐藏', `${hiddenCount} 张`]
    ].map(([label, value]) => `
        <div>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
        </div>
    `).join('');
}

function pulseInspector() {
    window.clearTimeout(state.inspectorPulseTimer);
    elements.photoInspectorContent.classList.remove('is-refreshing');
    void elements.photoInspectorContent.offsetWidth;
    elements.photoInspectorContent.classList.add('is-refreshing');
    state.inspectorPulseTimer = window.setTimeout(() => {
        elements.photoInspectorContent.classList.remove('is-refreshing');
    }, 320);
}

function renderLogs() {
    if (state.loadingDetail) {
        elements.logList.innerHTML = skeletonList(4);
        return;
    }

    elements.logList.innerHTML = state.logs.length
        ? state.logs.map((log) => `
            <article class="log-item">
                <div class="log-main">
                    <strong>${escapeHtml(log.actor_name || '系统')}</strong>
                    <span>${escapeHtml(actionLabel(log.action))}</span>
                </div>
                <div class="log-meta">
                    <span>${escapeHtml(log.target_type || '-')}</span>
                    <span>${escapeHtml(formatDateTime(log.created_at))}</span>
                </div>
                ${log.detail ? `<div class="hint small">${escapeHtml(formatDetail(log.detail))}</div>` : ''}
            </article>
        `).join('')
        : '<div class="empty-state">当前相册还没有操作记录。</div>';
}

function renderSectionTabs() {
    elements.sectionTabs.forEach((button) => {
        button.classList.toggle('active', button.dataset.section === state.currentSection);
    });

    elements.sectionPanels.forEach((panel) => {
        panel.classList.toggle('active', panel.dataset.panel === state.currentSection);
    });
}

function getFilteredPhotos() {
    return state.photos;
}

function resetPhotoRenderWindow() {
    state.photoRenderCount = 0;
}

function revealMoreAdminPhotos() {
    const filtered = getFilteredPhotos();
    if (state.photoRenderCount >= filtered.length) {
        return false;
    }
    state.photoRenderCount = Math.min(filtered.length, state.photoRenderCount + state.photoRenderChunkSize);
    renderPhotoGallery();
    renderPhotoCount();
    return true;
}

function ensurePhotoGalleryObserver() {
    if (!elements.photoGallerySentinel) {
        return;
    }

    if (ensurePhotoGalleryObserver.observer) {
        ensurePhotoGalleryObserver.observer.disconnect();
    }

    if (elements.photoGallerySentinel.hidden) {
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting || state.loadingDetail) {
                return;
            }
            if (revealMoreAdminPhotos()) {
                return;
            }
            loadAdminPhotos(false).catch((error) => showToast(error.message));
        });
    }, {
        rootMargin: '500px 0px'
    });

    observer.observe(elements.photoGallerySentinel);
    ensurePhotoGalleryObserver.observer = observer;
}

function getSelectedPhoto() {
    const photo = state.photos.find((item) => item.id === Number(state.selectedPhotoId)) || null;
    if (!photo) {
        return null;
    }
    return {
        ...photo,
        ...(state.photoDetails[photo.id] || {})
    };
}

async function ensurePhotoDetailLoaded(photoId) {
    const id = Number(photoId);
    if (!id || state.photoDetails[id] || state.photoDetailLoading.has(id)) {
        return;
    }

    state.photoDetailLoading.add(id);
    try {
        const response = await api(`/photos/admin/${id}`);
        state.photoDetails[id] = response.data;
        if (Number(state.selectedPhotoId) === id) {
            renderPhotoInspector();
        }
    } finally {
        state.photoDetailLoading.delete(id);
    }
}

function buildAdminGalleryThumbSrc(photo) {
    const base = photo.thumbnail_url || photo.compressed_url || photo.watermarked_url || photo.original_url || '';
    if (!base) {
        return '';
    }
    if (/imageMogr2|imageView2|thumb=/i.test(base)) {
        return base;
    }
    if (/qiniu|clouddn|qiniucdn|qbox\.me|jack-sun\.com\/qiniu/i.test(base)) {
        const separator = base.includes('?') ? '|' : '?';
        return `${base}${separator}imageView2/1/w/420/h/420/q/62`;
    }
    return base;
}

function getSelectedPhotos() {
    return state.photos.filter((photo) => state.selectedPhotoIds.has(photo.id));
}

function toggleBatchMode() {
    state.batchMode = !state.batchMode;
    if (!state.batchMode) {
        state.selectedPhotoIds.clear();
    }
    renderPhotoWorkspace();
}

function resetAdminSmartFilters() {
    state.filters.camera = '';
    state.filters.lens = '';
    state.filters.focalLength = '';
    state.filters.aperture = '';
    state.filters.iso = '';
    state.filters.format = '';
    resetPhotoRenderWindow();
    loadAdminPhotos(true).catch((error) => showToast(error.message));
}

function togglePhotoSelection(photoId) {
    if (state.selectedPhotoIds.has(photoId)) {
        state.selectedPhotoIds.delete(photoId);
    } else {
        state.selectedPhotoIds.add(photoId);
    }
    renderPhotoWorkspace();
}

function selectAllFilteredPhotos() {
    getFilteredPhotos().forEach((photo) => state.selectedPhotoIds.add(photo.id));
    renderPhotoWorkspace();
}

function clearSelectedPhotos() {
    state.selectedPhotoIds.clear();
    renderPhotoWorkspace();
}

async function batchUpdateVisibility(isPublic) {
    const photos = getSelectedPhotos();
    if (!photos.length) {
        showToast('请先选择要批量处理的照片');
        return;
    }

    await api('/photos/batch-update', {
        method: 'POST',
        body: JSON.stringify({
            ids: photos.map((photo) => photo.id),
            is_public: isPublic
        })
    });

    showToast(isPublic ? '已批量设为显示' : '已批量设为隐藏');
    state.selectedPhotoIds.clear();
    await selectLive(state.currentLive.id);
}

async function batchUpdateAlbum() {
    const photos = getSelectedPhotos();
    if (!photos.length) {
        showToast('请先选择要批量处理的照片');
        return;
    }

    const albumId = elements.batchEditorAlbumSelect.value || null;
    await api('/photos/batch-update', {
        method: 'POST',
        body: JSON.stringify({
            ids: photos.map((photo) => photo.id),
            album_id: albumId
        })
    });

    showToast('已批量更新分类');
    await selectLive(state.currentLive.id);
    photos.forEach((photo) => state.selectedPhotoIds.add(photo.id));
    state.batchMode = true;
    renderPhotoWorkspace();
}

async function batchAppendTags() {
    const photos = getSelectedPhotos();
    if (!photos.length) {
        showToast('请先选择要批量处理的照片');
        return;
    }

    const extraTags = parseTagList(elements.batchEditorTagsInput.value);
    if (!extraTags.length) {
        showToast('请先填写要补充的标签');
        return;
    }

    await api('/photos/batch-update', {
        method: 'POST',
        body: JSON.stringify({
            ids: photos.map((photo) => photo.id),
            append_tags: extraTags
        })
    });

    elements.batchEditorTagsInput.value = '';
    showToast('已批量补充标签');
    await selectLive(state.currentLive.id);
    photos.forEach((photo) => state.selectedPhotoIds.add(photo.id));
    state.batchMode = true;
    renderPhotoWorkspace();
}

async function batchDeleteSelectedPhotos() {
    const photos = getSelectedPhotos();
    if (!photos.length) {
        showToast('请先选择要删除的照片');
        return;
    }

    if (!window.confirm(`确定删除这 ${photos.length} 张照片？该操作不可恢复。`)) {
        return;
    }

    await createPhotoDeleteJob(photos.map((photo) => photo.id), '批量删除照片');

    showToast(`已删除 ${photos.length} 张照片`);
    state.selectedPhotoIds.clear();
    state.selectedPhotoId = null;
    await loadLives();
    await selectLive(state.currentLive.id);
}

function buildPhotoUpdatePayload(photo, overrides = {}) {
    return {
        title: photo.title || '',
        description: photo.description || '',
        tags: Array.isArray(overrides.tags) ? overrides.tags.join(', ') : (photo.tags || []).join(', '),
        album_id: Object.prototype.hasOwnProperty.call(overrides, 'album_id') ? overrides.album_id : (photo.album_id || null),
        is_public: Object.prototype.hasOwnProperty.call(overrides, 'is_public') ? overrides.is_public : Number(photo.is_public ?? 1)
    };
}

async function copySelectedPhotoLinks(mode) {
    const photos = getSelectedPhotos();
    if (!photos.length) {
        showToast('请先选择要复制链接的照片');
        return;
    }

    const text = photos
        .map((photo) => pickPhotoLinkByMode(photo, mode))
        .filter(Boolean)
        .join('\n');

    if (!text) {
        showToast('当前没有可复制的图片链接');
        return;
    }

    const copied = await copyText(text);
    showToast(copied
        ? `已复制 ${photos.length} 条${mode === 'preview' ? '展示' : '原图'}链接`
        : '链接已选中，可手动复制');
}

async function copyCurrentPhotoLink(mode) {
    const photo = getSelectedPhoto();
    if (!photo) {
        showToast('请先选择照片');
        return;
    }

    const link = pickPhotoLinkByMode(photo, mode);
    if (!link) {
        showToast('当前没有可复制的图片链接');
        return;
    }

    const copied = await copyText(link);
    showToast(copied
        ? `${mode === 'preview' ? '展示图' : '原图'}链接已复制`
        : '链接已选中，可手动复制');
}

function getLiveStats() {
    return {
        photoCount: state.photos.length,
        albumCount: state.albums.length,
        likes: state.photos.reduce((sum, photo) => sum + Number(photo.like_count || 0), 0),
        views: state.photos.reduce((sum, photo) => sum + Number(photo.view_count || 0), 0)
    };
}

async function copyShareLink() {
    if (!state.currentLive?.slug) {
        showToast('请先进入一个相册');
        return;
    }

    const link = `${window.location.origin}/live/${state.currentLive.slug}`;
    const copied = await copyText(link);
    showToast(copied ? '客户链接已复制' : '已选中链接，可手动复制');
}

async function api(path, options = {}, withAuth = true) {
    const response = await fetch(`/api${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(withAuth && state.token ? { Authorization: `Bearer ${state.token}` } : {}),
            ...(options.headers || {})
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || '请求失败');
    }

    return data;
}

async function downloadWithAuth(path, fallbackName) {
    const response = await fetch(path, {
        headers: {
            Authorization: `Bearer ${state.token}`
        }
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || '下载失败');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const disposition = response.headers.get('Content-Disposition') || '';
    const matched = disposition.match(/filename="?([^"]+)"?/);
    link.href = url;
    link.download = decodeURIComponent(matched?.[1] || fallbackName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function toggleScreens(showDashboard) {
    elements.loginScreen.hidden = showDashboard;
    elements.dashboard.hidden = !showDashboard;
    elements.loginScreen.style.display = showDashboard ? 'none' : 'grid';
    elements.dashboard.style.display = showDashboard ? 'block' : 'none';
}

function resetLogin() {
    state.token = '';
    state.user = null;
    state.lives = [];
    state.currentLive = null;
    state.albums = [];
    state.photos = [];
    state.logs = [];
    state.users = [];
    state.currentView = 'library';
    state.selectedPhotoId = null;
    state.selectedPhotoIds.clear();
    state.batchMode = false;
    state.cleanupJob = null;
    window.clearTimeout(state.cleanupPollTimer);
    state.cleanupPollTimer = 0;
    window.clearTimeout(state.deleteTaskPollTimer);
    state.deleteTaskPollTimer = 0;
    state.cleanupWidgetVisible = false;
    if (elements.uploadComposer) {
        elements.uploadComposer.hidden = true;
    }
    resetUploadSession();
    localStorage.removeItem('photo_live_token');
    renderLoggedOut();
}

function showToast(text) {
    elements.toast.textContent = text;
    elements.toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => elements.toast.classList.remove('show'), 2200);
}

function pickPhotoLinkByMode(photo, mode) {
    if (!photo) {
        return '';
    }

    if (mode === 'preview') {
        return photo.compressed_url || photo.watermarked_url || photo.original_url || '';
    }

    return photo.original_url || '';
}

async function copyText(text) {
    if (!text) {
        return false;
    }

    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (_error) {
        // Fallback below.
    }

    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', 'readonly');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.focus();
    input.select();
    try {
        return document.execCommand('copy');
    } finally {
        input.remove();
    }
}

function parseTagList(input) {
    return String(input || '')
        .split(/[，,]/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (!value) {
        return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let index = 0;
    let current = value;

    while (current >= 1024 && index < units.length - 1) {
        current /= 1024;
        index += 1;
    }

    const precision = current >= 100 || index === 0 ? 0 : 1;
    return `${current.toFixed(precision)} ${units[index]}`;
}

function skeletonCards(count) {
    return Array.from({ length: count }).map(() => `
        <article class="album-card skeleton-card">
            <div class="skeleton skeleton-line"></div>
            <div class="skeleton skeleton-line short"></div>
            <div class="skeleton skeleton-line short"></div>
        </article>
    `).join('');
}

function skeletonList(count) {
    return Array.from({ length: count }).map(() => `
        <article class="stack-item skeleton-card">
            <div class="stack-item-meta">
                <div class="skeleton skeleton-line"></div>
                <div class="skeleton skeleton-line short"></div>
            </div>
        </article>
    `).join('');
}

function actionLabel(action) {
    const labels = {
        'live.create': '创建相册',
        'live.update': '更新相册',
        'live.delete': '删除相册',
        'album.create': '新增分类',
        'album.update': '更新分类',
        'album.delete': '删除分类',
        'photo.upload.batch': '批量上传照片',
        'photo.upload.batch.direct': '七牛直传照片',
        'photo.update': '更新照片信息',
        'photo.delete': '删除照片',
        'photo.download.batch.admin': '后台批量下载'
    };
    return labels[action] || action;
}

function formatDetail(detail) {
    if (!detail) {
        return '';
    }
    if (typeof detail === 'string') {
        return detail;
    }
    return Object.entries(detail).map(([key, value]) => `${key}: ${value}`).join(' · ');
}

function toLocalDateTime(value) {
    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDateTime(value) {
    return value ? new Date(value).toLocaleString('zh-CN') : '未设置';
}

function formatDateOnly(value) {
    return value ? new Date(value).toLocaleDateString('zh-CN') : '未设置时间';
}

function formatStatus(status) {
    if (status === 'live') {
        return '可查看';
    }
    if (status === 'ended') {
        return '已归档';
    }
    return '整理中';
}

function slugFromTitle(text) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

async function attachFileHashes(files) {
    const enriched = new Array(files.length);
    await runLimitedConcurrency(files, HASH_CONCURRENCY, async (file, index) => {
        updateUploadItem(index, {
            status: 'processing',
            progress: 0,
            statusText: '正在校验重复照片'
        });
        const fileHash = await computeFileHash(file);
        updateUploadItem(index, {
            status: 'waiting',
            progress: 0,
            statusText: '校验完成，等待上传'
        });
        enriched[index] = { file, fileHash };
    });
    return enriched;
}

async function computeFileHash(file) {
    const buffer = await file.arrayBuffer();
    if (typeof Worker !== 'undefined') {
        try {
            return await hashFileInWorker(buffer);
        } catch (_error) {
            // Fall back to main thread hashing below.
        }
    }
    if (window.crypto?.subtle?.digest) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        return Array.from(new Uint8Array(hashBuffer))
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
    }

    return fingerprintBuffer(buffer);
}

function hashFileInWorker(buffer) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(HASH_WORKER_URL);
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const cleanup = () => {
            worker.onmessage = null;
            worker.onerror = null;
            worker.terminate();
        };

        worker.onmessage = (event) => {
            const data = event.data || {};
            if (data.id !== id) {
                return;
            }
            cleanup();
            if (data.error) {
                reject(new Error(data.error));
                return;
            }
            resolve(String(data.hash || ''));
        };

        worker.onerror = (error) => {
            cleanup();
            reject(error);
        };

        worker.postMessage({ id, buffer }, [buffer]);
    });
}

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

function safeFileName(input) {
    return String(input || 'photos')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) || 'photos';
}

function safeJsonParse(input, fallback = {}) {
    try {
        return JSON.parse(input);
    } catch (_error) {
        return fallback;
    }
}

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
