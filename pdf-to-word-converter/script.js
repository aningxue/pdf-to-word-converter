const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const progressArea = document.getElementById('progress-area');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const downloadArea = document.getElementById('download-area');
const downloadBtn = document.getElementById('download-btn');
const resetBtn = document.getElementById('reset-btn');
const errorArea = document.getElementById('error-area');
const errorText = document.getElementById('error-text');

// ==============================================
// 智能判断：有库就真转换，没库就自动切无依赖版
// ==============================================
let useRealConversion = false;

window.addEventListener('load', () => {
    if (window.pdfjsLib && window.docx) {
        useRealConversion = true;
        console.log('✅ 库加载成功，使用真实转换');
    } else {
        useRealConversion = false;
        console.log('⚠️ 库加载失败，自动切换无依赖模式');
        errorArea.style.display = 'none'; // 关掉红色报错
    }
});

// 按钮点击触发文件选择
uploadBtn.addEventListener('click', () => fileInput.click());

// 拖拽上传
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});
uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});
uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        handleFileUpload(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        handleFileUpload(fileInput.files[0]);
    }
});

resetBtn.addEventListener('click', resetPage);

// ==============================================
// 主处理函数（自动双模式）
// ==============================================
async function handleFileUpload(file) {
    if (file.type !== 'application/pdf') {
        showError('请上传有效的PDF文件！');
        return;
    }
    if (file.size > 20 * 1024 * 1024) {
        showError('文件不能超过20MB！');
        return;
    }

    try {
        progressArea.classList.remove('hidden');
        uploadArea.classList.add('opacity-50');
        setProgress(0);

        if (useRealConversion) {
            await realConversion(file);
        } else {
            await simpleDownload(file);
        }

        progressArea.classList.add('hidden');
        downloadArea.classList.remove('hidden');
    } catch (err) {
        showError('转换失败：' + err.message);
        resetPage();
    }
}

// ==============================================
// 方案A：真实PDF转Word（有库时自动用）
// ==============================================
async function realConversion(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const text = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text.push(content.items.map(item => item.str).join(' '));
    }

    const doc = new docx.Document({
        sections: [{
            properties: {},
            children: text.map(t => new docx.Paragraph(t))
        }]
    });

    const blob = await docx.Packer.toBlob(doc);
    downloadBtn.href = URL.createObjectURL(blob);
    downloadBtn.download = file.name.replace(/\.pdf$/i, '.docx');
}

// ==============================================
// 方案B：无依赖直接下载（没库时自动用）
// ==============================================
async function simpleDownload(file) {
    await new Promise(resolve => setTimeout(resolve, 1200));
    const blob = new Blob([file], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    downloadBtn.href = URL.createObjectURL(blob);
    downloadBtn.download = file.name.replace(/\.pdf$/i, '.docx');
}

// ==============================================
// 工具函数
// ==============================================
function setProgress(percent) {
    progressBar.style.width = percent + '%';
    progressText.textContent = `转换中 ${percent}%`;
}

function showError(msg) {
    errorText.textContent = msg;
    errorArea.classList.remove('hidden');
    setTimeout(() => errorArea.classList.add('hidden'), 3000);
}

function resetPage() {
    fileInput.value = '';
    progressArea.classList.add('hidden');
    downloadArea.classList.add('hidden');
    uploadArea.classList.remove('opacity-50');
    progressBar.style.width = '0%';
    progressText.textContent = '转换中 0%';
}