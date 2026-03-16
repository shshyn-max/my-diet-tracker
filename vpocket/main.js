const firebaseConfig = {
    apiKey: "AIzaSyAlMx_uSh9FuB1gbZj3DzB1u1qX6kKnSuw", authDomain: "voucher-pocket.firebaseapp.com",
    projectId: "voucher-pocket", storageBucket: "voucher-pocket.firebasestorage.app",
    messagingSenderId: "789053008764", appId: "1:789053008764:web:49070106255927785f92f9"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const DOC_REF = db.collection("vouchers").doc("v3_data"); 

let dbData = { vouchers: [] };
let currentVoucherIdx = null;
let currentHistoryIdx = null;
let isEditMode = false;

window.showView = (viewId) => {
    document.querySelectorAll('.container > div').forEach(el => el.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    if(viewId === 'view-list') renderList();
    if(viewId === 'view-archive') renderArchive();
};

function init() {
    DOC_REF.onSnapshot((snap) => {
        if (snap.exists) {
            dbData = snap.data();
            renderList();
        } else {
            // 문서가 없을 경우 초기화 대비
            dbData = { vouchers: [] };
            renderList();
        }
    });
}

function renderList() {
    const container = document.getElementById('voucher-container');
    const activeVouchers = dbData.vouchers.filter(v => !v.isDone);
    if (activeVouchers.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:var(--sub-text); margin-top:40px;">사용 가능한 상품권이 없습니다.</p>`;
        return;
    }
    const sorted = activeVouchers
        .map(v => ({ ...v, originalIdx: dbData.vouchers.indexOf(v) }))
        .sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
    container.innerHTML = sorted.map(v => generateCardHtml(v, false)).join('');
}

function renderArchive() {
    const container = document.getElementById('archive-container');
    const doneVouchers = dbData.vouchers.filter(v => v.isDone);
    if (doneVouchers.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:var(--sub-text); margin-top:40px;">완료된 내역이 없습니다.</p>`;
        return;
    }
    const sorted = doneVouchers
        .map(v => ({ ...v, originalIdx: dbData.vouchers.indexOf(v) }))
        .sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
    container.innerHTML = sorted.map(v => generateCardHtml(v, true)).join('');
}

function generateCardHtml(v, isArchive) {
    const realIdx = v.originalIdx;
    const history = v.history || [];
    const used = history.reduce((s, h) => s + h.amount, 0);
    const balance = v.total - used;
    const { text, isUrgent } = getDdayInfo(v.expiry);
    const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = sortedHistory.length > 0 ? sortedHistory[0] : null;
    const isExpanded = localStorage.getItem('expandedVoucherId') === String(realIdx);

    return `
        <div class="list-card ${isArchive ? 'archive-card' : ''}">
            <div class="list-header">
                <div class="info-left-group">
                    <div class="list-info-top">
                        <div class="title-row">
                            <span class="category-tag">${v.category || '기타'}</span>
                            <h3 class="card-black-text" style="margin:0; font-size:1.1rem; font-weight:700;">${v.name || '상품권'}</h3>
                        </div>
                        <div class="title-actions">
                            <button class="btn-mini" onclick="quickEdit(${realIdx})">편집</button>
                            <button class="btn-mini del" onclick="quickDelete(${realIdx})">삭제</button>
                            ${!isArchive ? `<button class="btn-mini done" onclick="markAsDone(${realIdx})">사용완료</button>` : `<button class="btn-mini" onclick="markAsActive(${realIdx})">복원</button>`}
                        </div>
                    </div>
                    <div class="card-black-text" style="font-size:1.2rem; font-weight:800; margin-top:4px;">${balance.toLocaleString()}원</div>
                </div>
                <div style="text-align:right; flex-shrink:0;">
                    <span style="font-weight:800; font-size:1.1rem; color:${isUrgent ? 'var(--urgent)' : 'var(--primary)'}; ${isUrgent ? 'animation: blink 1.2s infinite;' : ''}">${text}</span>
                </div>
            </div>
            
            <div class="list-history-box">
                ${latest ? `
                    <div class="history-summary">
                        <span>최근: ${latest.date}</span>
                        <span>-${latest.amount.toLocaleString()}원</span>
                    </div>
                    <div id="full-history-${realIdx}" class="${isExpanded ? '' : 'hidden'} history-full">
                        ${sortedHistory.map((h) => {
                            const origHIdx = dbData.vouchers[realIdx].history.findIndex(item => item === h);
                            return `
                            <div class="history-row">
                                <div style="flex:1;"><span>${h.date}</span> <strong style="margin-left:5px;">-${h.amount.toLocaleString()}원</strong></div>
                                <div class="history-actions">
                                    <button class="btn-history-mini" onclick="editHistory(${realIdx}, ${origHIdx})">편집</button>
                                    <button class="btn-history-mini del" onclick="deleteHistory(${realIdx}, ${origHIdx})">삭제</button>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                    <button class="btn-expand" onclick="toggleHistory(event, ${realIdx})">${isExpanded ? "내역 접기 ▲" : "내역 펼치기 ▼"}</button>
                ` : '<div style="color:#cbd5e0; text-align:center; font-size:0.75rem;">사용 내역 없음</div>'}
            </div>

            <div class="list-actions-bottom">
                <button class="btn-bottom btn-view" onclick="openVoucherImg(${realIdx})">상품권 보기</button>
                <button class="btn-bottom btn-input" onclick="showDetail(${realIdx})">사용내역 입력</button>
            </div>
        </div>
    `;
}

window.markAsDone = async (idx) => {
    if(!confirm("이 상품권을 사용완료 처리할까요?")) return;
    dbData.vouchers[idx].isDone = true;
    await DOC_REF.set(dbData);
    renderList();
};

window.markAsActive = async (idx) => {
    dbData.vouchers[idx].isDone = false;
    await DOC_REF.set(dbData);
    renderArchive();
};

window.toggleHistory = (e, idx) => {
    e.stopPropagation();
    const full = document.getElementById(`full-history-${idx}`);
    const btn = e.target;
    if(full.classList.contains('hidden')) {
        full.classList.remove('hidden'); btn.innerText = "내역 접기 ▲";
        localStorage.setItem('expandedVoucherId', idx);
    } else {
        full.classList.add('hidden'); btn.innerText = "내역 펼치기 ▼";
        localStorage.removeItem('expandedVoucherId');
    }
};

window.editHistory = (vIdx, hIdx) => {
    currentVoucherIdx = vIdx; currentHistoryIdx = hIdx;
    const h = dbData.vouchers[vIdx].history[hIdx];
    localStorage.setItem('expandedVoucherId', vIdx);
    document.getElementById('detailHeaderTitle').innerText = "내역 수정";
    document.getElementById('useDate').value = h.date;
    document.getElementById('useAmount').value = h.amount;
    showView('view-detail');
};

window.deleteHistory = async (vIdx, hIdx) => {
    if(!confirm("이 사용 내역을 삭제할까요?")) return;
    localStorage.setItem('expandedVoucherId', vIdx);
    dbData.vouchers[vIdx].history.splice(hIdx, 1);
    await DOC_REF.set(dbData);
    dbData.vouchers[vIdx].isDone ? renderArchive() : renderList();
};

function getDdayInfo(dateStr) {
    if(!dateStr) return { text: "정보없음", isUrgent: false };
    const today = new Date(); today.setHours(0,0,0,0);
    const exp = new Date(dateStr);
    const diff = Math.ceil((exp - today) / (1000*60*60*24));
    if (diff < 0) return { text: "만료", isUrgent: true };
    return { text: `D-${diff}`, isUrgent: diff <= 7 };
}

window.openVoucherImg = (idx) => {
    const v = dbData.vouchers[idx];
    const w = window.open("");
    w.document.write(`<html><head><title>상품권 보기</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>
        body { margin:0; background:#000; display:flex; justify-content:center; align-items:center; min-height:100vh; overflow:hidden; font-family:sans-serif; }
        img { max-width:100%; max-height:100vh; object-fit: contain; cursor: pointer; }
        .close-btn { position: fixed; top: 20px; right: 20px; background: rgba(0,0,0,0.6); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 10px 20px; border-radius: 30px; font-weight: bold; cursor: pointer; backdrop-filter: blur(5px); }
    </style></head>
    <body><button class="close-btn" onclick="window.close()">닫기 ✕</button><img src="${v.img}" onclick="window.close()"></body></html>`);
};

window.quickEdit = (idx) => {
    currentVoucherIdx = idx; const v = dbData.vouchers[idx]; isEditMode = true;
    document.getElementById('form-title').innerText = "상품권 편집";
    document.getElementById('vName').value = v.name || '';
    document.getElementById('vCategory').value = v.category || '기타';
    document.getElementById('vTotal').value = v.total;
    document.getElementById('vExpiry').value = v.expiry;
    document.getElementById('vImgPreview').src = v.img;
    document.getElementById('imgEditBlock').classList.remove('hidden');
    showView('view-form');
};

window.quickDelete = async (idx) => {
    if(!confirm("이 상품권을 영구 삭제할까요?")) return;
    dbData.vouchers.splice(idx, 1); await DOC_REF.set(dbData); 
    renderList(); renderArchive();
};

window.showDetail = (idx) => {
    currentVoucherIdx = idx; currentHistoryIdx = null;
    localStorage.setItem('expandedVoucherId', idx);
    const v = dbData.vouchers[idx];
    document.getElementById('detailHeaderTitle').innerText = (v.name || '상품권');
    document.getElementById('useDate').valueAsDate = new Date();
    document.getElementById('useAmount').value = '';
    showView('view-detail');
};

window.addHistory = async () => {
    const date = document.getElementById('useDate').value;
    const amount = parseInt(document.getElementById('useAmount').value);
    if(!date || isNaN(amount)) return alert("날짜와 금액을 입력해 주세요.");
    const history = dbData.vouchers[currentVoucherIdx].history || [];
    if (currentHistoryIdx !== null) history[currentHistoryIdx] = { date, amount };
    else history.push({ date, amount });
    dbData.vouchers[currentVoucherIdx].history = history;
    await DOC_REF.set(dbData); currentHistoryIdx = null;
    dbData.vouchers[currentVoucherIdx].isDone ? showView('view-archive') : showView('view-list');
};

window.saveVoucher = async () => {
    const name = document.getElementById('vName').value;
    const category = document.getElementById('vCategory').value;
    const total = parseInt(document.getElementById('vTotal').value);
    const expiry = document.getElementById('vExpiry').value;
    const fileInput = document.getElementById('vImg');
    const file = fileInput.files[0];

    if(!name || isNaN(total) || !expiry) {
        alert("필수 정보를 입력해주세요.");
        return;
    }

    if (!isEditMode && !file) {
        alert("이미지를 선택해주세요.");
        return;
    }

    // [핵심] 이미지 리사이징 함수
    const resizeImage = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_SIZE = 800; // 최대 가로/세로 크기 800px로 제한

                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    // 0.7 정도의 품질로 압축 (용량 대폭 감소)
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    const performSave = async (imageData) => {
        try {
            if (isEditMode) {
                const v = dbData.vouchers[currentVoucherIdx];
                v.name = name;
                v.category = category;
                v.total = total;
                v.expiry = expiry;
                if (imageData) v.img = imageData;
            } else {
                dbData.vouchers.push({
                    name, category, img: imageData, total, 
                    expiry, history: [], isDone: false
                });
            }

            await DOC_REF.set(dbData);
            showView('view-list');
        } catch (error) {
            console.error("저장 실패:", error);
            alert("데이터가 너무 커서 저장에 실패했습니다. (이미지 크기 확인 필요)");
        }
    };

    if (file) {
        // 이미지를 압축한 후 저장 실행
        const resizedData = await resizeImage(file);
        await performSave(resizedData);
    } else {
        await performSave(null);
    }
};

window.showAddView = () => { isEditMode = false; document.getElementById('form-title').innerText = "상품권 등록"; document.getElementById('vCategory').value = "기타"; document.getElementById('imgEditBlock').classList.add('hidden'); clearForm(); showView('view-form'); };
function clearForm() { document.getElementById('vName').value = ''; document.getElementById('vImg').value = ''; document.getElementById('vTotal').value = ''; document.getElementById('vExpiry').value = ''; }

init();
