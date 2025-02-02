document.addEventListener('DOMContentLoaded', () => {
    const oneButton = document.getElementById('oneButton');
    const postButton = document.getElementById('postButton');
    const likeButton = document.getElementById('likeButton');
    const mixButton = document.getElementById('mixButton');
    const folderSelector = document.getElementById('folderSelector');
    const accountList = document.getElementById('accountList');
    const timeline = document.getElementById('timeline');
    const loadAllButton = document.createElement('button');
    const themeToggleButton = document.createElement('button');
    
    loadAllButton.id = 'loadAllButton';
    loadAllButton.className = 'nav-button';
    loadAllButton.textContent = '加载全部';
    themeToggleButton.id = 'themeToggleButton';
    themeToggleButton.className = 'nav-button';
    themeToggleButton.textContent = '切换主题';
    
    const navButtons = document.querySelector('.nav-buttons');
    navButtons.appendChild(loadAllButton);
    navButtons.appendChild(themeToggleButton);

    let currentMode = 'one';
    let currentFolder = '';
    let currentAccount = '';
    let currentPage = 1;
    let isLoadingMore = false;
    let loadAll = false;
    const PAGE_SIZE = 50;

    // 主题切换
    let isDarkMode = localStorage.getItem('darkMode') === 'true';
    function toggleTheme() {
        isDarkMode = !isDarkMode;
        document.body.classList.toggle('dark-mode', isDarkMode);
        localStorage.setItem('darkMode', isDarkMode);
    }

    themeToggleButton.addEventListener('click', toggleTheme);
    document.body.classList.toggle('dark-mode', isDarkMode);

    // 加载全部内容
    loadAllButton.addEventListener('click', () => {
        loadAll = !loadAll;
        loadAllButton.classList.toggle('active', loadAll);
        if (currentAccount) {
            currentPage = 1;
            loadContent();
        }
    });

    // 添加拖拽区域
    document.body.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    document.body.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const items = e.dataTransfer.items;
        if (items && items.length > 0) {
            const item = items[0];
            if (item.kind === 'file') {
                const handle = await item.getAsFileSystemHandle();
                if (handle.kind === 'directory') {
                    await handleFolderSelection(handle);
                }
            }
        }
    });

    // 切换模式（one/post/like/mix）
    oneButton.addEventListener('click', () => {
        currentMode = 'one';
        oneButton.classList.add('active');
        postButton.classList.remove('active');
        likeButton.classList.remove('active');
        mixButton.classList.remove('active');
        loadAccounts();
    });

    postButton.addEventListener('click', () => {
        currentMode = 'post';
        postButton.classList.add('active');
        oneButton.classList.remove('active');
        likeButton.classList.remove('active');
        mixButton.classList.remove('active');
        loadAccounts();
    });

    likeButton.addEventListener('click', () => {
        currentMode = 'like';
        likeButton.classList.add('active');
        oneButton.classList.remove('active');
        postButton.classList.remove('active');
        mixButton.classList.remove('active');
        loadAccounts();
    });

    mixButton.addEventListener('click', () => {
        currentMode = 'mix';
        mixButton.classList.add('active');
        oneButton.classList.remove('active');
        postButton.classList.remove('active');
        likeButton.classList.remove('active');
        loadAccounts();
    });

    // 选择文件夹
    folderSelector.addEventListener('click', async () => {
        try {
            const dirHandle = await window.showDirectoryPicker();
            await handleFolderSelection(dirHandle);
        } catch (err) {
            console.error('Error selecting folder:', err);
        }
    });

    // 处理文件夹选择
    async function handleFolderSelection(dirHandle) {
        try {
            const douyinDirs = await findDouyinFolders(dirHandle);
            if (douyinDirs.length === 0) {
                alert('未找到douyin文件夹，请选择正确的目录');
            } else if (douyinDirs.length > 1) {
                alert('检测到多个douyin文件夹，请确保目录结构正确');
            } else {
                currentFolder = douyinDirs[0];
                loadAccounts();
            }
        } catch (err) {
            console.error('Error handling folder selection:', err);
        }
    }

    // 递归查找douyin文件夹
    async function findDouyinFolders(dirHandle, depth = 0, results = []) {
        if (depth > 5) return results;
        
        if (dirHandle.name === 'douyin') {
            results.push(dirHandle);
        }

        try {
            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'directory') {
                    await findDouyinFolders(entry, depth + 1, results);
                }
            }
        } catch (err) {
            console.error('Error searching directory:', err);
        }

        return results;
    }

    // 加载账号列表
    async function loadAccounts() {
        accountList.innerHTML = '';
        if (!currentFolder) return;

        try {
            const targetDir = await getTargetDirectory();
            if (!targetDir) return;

            const accounts = new Set();

            for await (const entry of targetDir.values()) {
                if (entry.kind === 'directory') {
                    accounts.add(entry.name);
                }
            }

            accounts.forEach(account => {
                const div = document.createElement('div');
                div.className = 'account-item';
                div.textContent = account;
                div.addEventListener('click', () => {
                    document.querySelectorAll('.account-item').forEach(item => {
                        item.classList.remove('active');
                    });
                    div.classList.add('active');
                    currentAccount = account;
                    currentPage = 1;
                    loadContent();
                });
                accountList.appendChild(div);
            });
        } catch (err) {
            console.error('Error loading accounts:', err);
        }
    }

    // 获取目标目录（one或post）
    async function getTargetDirectory() {
        try {
            return await currentFolder.getDirectoryHandle(currentMode);
        } catch (err) {
            console.error(`Error accessing ${currentMode} directory:`, err);
            return null;
        }
    }

    // 检查是否需要加载更多
    const content = document.querySelector('.content');
    content.addEventListener('scroll', checkLoadMore);

    function checkLoadMore() {
        if (isLoadingMore) return;
        
        const scrollHeight = content.scrollHeight;
        const scrollTop = content.scrollTop;
        const clientHeight = content.clientHeight;
    
        if (scrollHeight - scrollTop - clientHeight < 100) {
            loadContent(true);
        }
    }

    window.addEventListener('scroll', checkLoadMore);

    // 加载内容
    async function loadContent(append = false) {
        if (!currentFolder || !currentAccount || isLoadingMore) return;

        try {
            isLoadingMore = true;
            const targetDir = await getTargetDirectory();
            if (!targetDir) return;

            const accountDir = await targetDir.getDirectoryHandle(currentAccount);
            if (!append) {
                timeline.innerHTML = '';
            }

            const files = [];
            for await (const entry of accountDir.values()) {
                if (entry.kind === 'file') {
                    const match = entry.name.match(/^(\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2})_(.+?)_(image|video|live).*\.(jpg|webp|mp4)$/);
                    if (match) {
                        files.push({
                            name: entry.name,
                            timestamp: match[1],
                            title: match[2],
                            type: match[3],
                            entry: entry
                        });
                    }
                }
            }

            // 按时间戳排序
            files.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

            // 分页处理
            const startIndex = (currentPage - 1) * PAGE_SIZE;
            const endIndex = loadAll ? files.length : currentPage * PAGE_SIZE;
            const pageFiles = files.slice(startIndex, endIndex);

            // 按时间戳分组
            const groups = {};
            pageFiles.forEach(file => {
                if (!groups[file.timestamp]) {
                    groups[file.timestamp] = {
                        title: file.title,
                        files: []
                    };
                }
                groups[file.timestamp].files.push(file);
            });

            // 创建帖子
            for (const timestamp in groups) {
                const group = groups[timestamp];
                const post = document.createElement('div');
                post.className = 'post';

                const header = document.createElement('div');
                header.className = 'post-header';

                const time = document.createElement('div');
                time.className = 'post-time';
                time.textContent = timestamp;

                const title = document.createElement('div');
                title.className = 'post-title';
                title.textContent = group.title;

                const content = document.createElement('div');
                content.className = 'post-content';

                header.appendChild(time);
                header.appendChild(title);
                post.appendChild(header);
                post.appendChild(content);

                // 创建媒体查看器
                function createMediaViewer(mediaElement) {
                    const overlay = document.createElement('div');
                    overlay.className = 'media-viewer-overlay';
                    
                    const content = document.createElement('div');
                    content.className = 'media-viewer-content';
                    
                    const closeButton = document.createElement('button');
                    closeButton.className = 'media-viewer-close';
                    closeButton.innerHTML = '×';
                    closeButton.onclick = () => overlay.remove();
                    
                    const clonedMedia = mediaElement.cloneNode(true);
                    if (clonedMedia.tagName === 'VIDEO') {
                        clonedMedia.controls = true;
                    }
                    
                    content.appendChild(clonedMedia);
                    content.appendChild(closeButton);
                    overlay.appendChild(content);
                    document.body.appendChild(overlay);
                    
                    overlay.onclick = (e) => {
                        if (e.target === overlay) {
                            overlay.remove();
                        }
                    };
                    
                    // 添加ESC键盘事件监听
                    const handleEscKey = (e) => {
                        if (e.key === 'Escape') {
                            overlay.remove();
                            document.removeEventListener('keydown', handleEscKey);
                        }
                    };
                    document.addEventListener('keydown', handleEscKey);
                }

                // 添加媒体文件
                for (const file of group.files) {
                    const mediaItem = document.createElement('div');
                    mediaItem.className = 'media-item';

                    if (file.type === 'image') {
                        const img = document.createElement('img');
                        file.entry.getFile().then(f => {
                            img.src = URL.createObjectURL(f);
                        });
                        img.onclick = () => createMediaViewer(img);
                        mediaItem.appendChild(img);
                    } else if (file.type === 'video' || file.type === 'live') {
                        const video = document.createElement('video');
                        video.controls = true;
                        video.preload = 'metadata';
                        video.style.maxWidth = '100%';
                        file.entry.getFile().then(f => {
                            const url = URL.createObjectURL(f);
                            video.src = url;
                            video.onloadedmetadata = () => {
                                if (video.videoWidth > video.videoHeight) {
                                    video.style.width = '100%';
                                    video.style.height = 'auto';
                                } else {
                                    video.style.width = 'auto';
                                    video.style.height = '100%';
                                }
                            };
                        });
                        video.onclick = () => createMediaViewer(video);
                        mediaItem.appendChild(video);
                    }

                    content.appendChild(mediaItem);
                }

                timeline.appendChild(post);
            }

            if (pageFiles.length > 0) {
                currentPage++;
            }
        } catch (err) {
            console.error('Error loading content:', err);
        } finally {
            isLoadingMore = false;
        }
    }
});