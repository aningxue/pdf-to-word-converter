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

// 🔥 核心：增加CDN加载校验，适配Cloudflare全球访问
async function handleFileUpload(file) {
    // 校验核心库是否加载成功（Cloudflare部署必备）
    if (typeof pdfjsLib === 'undefined' || typeof window.docx === 'undefined') {
        showError('Conversion library loading failed, please refresh the page!');
        return;
    }

    if (file.type !== 'application/pdf') {
        showError('Please select a valid PDF file!');
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        showError('File size cannot exceed 10MB!');
        return;
    }

    try {
        progressArea.classList.remove('hidden');
        uploadArea.classList.add('opacity-50');

        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            if (progress > 100) progress = 100;
            progressBar.style.width = progress + '%';
            progressText.textContent = `Converting... ${progress}%`;
            if (progress === 100) clearInterval(interval);
        }, 200);

        // 解析PDF文本
        const pdfData = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join('\n');
            fullText += pageText + '\n\n';
        }

        // 生成标准DOCX（Cloudflare兼容的调用方式）
        const doc = new window.docx.Document();
        doc.addSection({
            children: [
                new window.docx.Paragraph({
                    children: [new window.docx.TextRun(fullText)],
                }),
            ],
        });

        setTimeout(async () => {
            progressArea.classList.add('hidden');
            downloadArea.classList.remove('hidden');

            const fileName = file.name.replace(/\.pdf$/i, '');
            const blob = await window.docx.Packer.toBlob(doc);
            downloadBtn.href = URL.createObjectURL(blob);
            downloadBtn.download = `${fileName}.docx`;

            uploadArea.classList.remove('opacity-50');
        }, 500);

    } catch (error) {
        showError('Conversion failed: ' + error.message);
        resetPage();
    }
}

function showError(message) {
    errorText.textContent = message;
    errorArea.classList.remove('hidden');
    setTimeout(() => {
        errorArea.classList.add('hidden');
    }, 4000);
}

function resetPage() {
    fileInput.value = '';
    progressArea.classList.add('hidden');
    downloadArea.classList.add('hidden');
    uploadArea.classList.remove('opacity-50');
    progressBar.style.width = '0%';
    progressText.textContent = 'Converting... 0%';
}