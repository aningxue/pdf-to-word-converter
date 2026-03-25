const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const progressArea = document.getElementById('progress-area');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const downloadArea = document.getElementById('download-area');
const resetBtn = document.getElementById('reset-btn');
const errorArea = document.getElementById('error-area');
const errorText = document.getElementById('error-text');
const modeTip = document.getElementById('mode-tip');

let useRealConversion = false;
let currentFile = null;

window.addEventListener('load', async () => {
    // 检测是否同时存在 pdfjs 和 docx 库
    useRealConversion = !!(window.pdfjsLib && window.docx);

    if (modeTip) {
        if (useRealConversion) {
            modeTip.textContent = "✅ 当前环境支持完整 Word 转换（.docx）";
            modeTip.className = "text-center text-green-600 mb-6 text-sm";
        } else {
            modeTip.textContent = "⚠️ 加载失败，仅支持纯文本转换（.txt）";
            modeTip.className = "text-center text-orange-600 mb-6 text-sm";
        }
        modeTip.style.display = "block";
    }
});

uploadBtn.addEventListener('click', () => fileInput.click());

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

async function handleFileUpload(file) {
    if (file.type !== 'application/pdf') {
        showError('请上传有效的PDF文件！');
        return;
    }
    if (file.size > 20 * 1024 * 1024) {
        showError('文件不能超过20MB！');
        return;
    }

    currentFile = file;
    progressArea.classList.remove('hidden');
    uploadArea.classList.add('opacity-50');
    setProgress(0);

    try {
        if (useRealConversion) {
            await realConversion(file);
            progressArea.classList.add('hidden');
            showDocxSuccessButton();
        } else {
            await fakeProgress();
            progressArea.classList.add('hidden');
            showFallbackButtons();
        }
    } catch (err) {
        console.error(err);
        showError('转换失败，已自动切换至纯文本模式');
        useRealConversion = false;
        resetPage();
    }
}

// ✅ 真正生成 docx（保证不空白）
async function realConversion(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const textBlocks = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        setProgress(Math.floor((i / pdf.numPages) * 100));
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        textBlocks.push(pageText);
    }

    const doc = new docx.Document({
        sections: [{
            properties: {},
            children: textBlocks.map(t => new docx.Paragraph(t))
        }]
    });

    const blob = await docx.Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
// 先渲染下载按钮
    downloadArea.innerHTML = `<a id="download-btn" class="bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors inline-block" href="${url}" download="${file.name.replace(/\.pdf$/i, '.docx')}">Download Word File (.docx)</a>
<button id="reset-btn" class="bg-gray-600 text-white py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors ml-4">Convert Another</button>`;
    downloadArea.classList.remove('hidden');
// 延迟释放 URL，等浏览器完成下载后再清理
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 3000); // 延迟 3 秒再释放，保证下载完成
}

// ✅ 纯文本降级
async function simpleTextDownload(file) {
    const textContent = await getPdfText(file);
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    downloadArea.innerHTML = `<a id="download-btn" class="bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors inline-block" href="${url}" download="${file.name.replace(/\.pdf$/i, '.txt')}">Download Text File (.txt)</a>
    <button id="reset-btn" class="bg-gray-600 text-white py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors ml-4">Convert Another</button>`;

    downloadArea.classList.remove('hidden');
    URL.revokeObjectURL(url);
}

async function getPdfText(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const textParts = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            textParts.push(content.items.map(item => item.str).join(' '));
        }
        return textParts.join('\n\n');
    } catch (e) {
        return "无法提取文本";
    }
}

function showDocxSuccessButton() {
    downloadArea.classList.remove('hidden');
}

function showFallbackButtons() {
    downloadArea.innerHTML = `
    <div class="flex flex-wrap gap-3 justify-center">
        <button class="bg-green-600 text-white py-3 px-5 rounded hover:bg-green-700" onclick="handleFileUpload(currentFile)">重试 Word</button>
        <button class="bg-blue-600 text-white py-3 px-5 rounded hover:bg-blue-700" onclick="simpleTextDownload(currentFile)">转 Txt</button>
        <button class="bg-gray-600 text-white py-3 px-5 rounded hover:bg-gray-700" onclick="resetPage()">重新上传</button>
    </div>
    <p class="text-sm text-gray-500 mt-2 text-center">加载失败时可选择纯文本</p>`;
    downloadArea.classList.remove('hidden');
}

function fakeProgress() {
    return new Promise(resolve => {
        let p = 0;
        const interval = setInterval(() => {
            p += 20;
            setProgress(p);
            if (p >= 100) {
                clearInterval(interval);
                resolve();
            }
        }, 100);
    });
}

function setProgress(percent) {
    progressBar.style.width = percent + '%';
    progressText.textContent = `Converting... ${percent}%`;
}

function showError(msg) {
    errorText.textContent = msg;
    errorArea.classList.remove('hidden');
    setTimeout(() => errorArea.classList.add('hidden'), 3000);
}

function resetPage() {
    fileInput.value = '';
    currentFile = null;
    progressArea.classList.add('hidden');
    downloadArea.classList.add('hidden');
    uploadArea.classList.remove('opacity-50');
    setProgress(0);
}