/**
 * POS Kasa Satış Terminali - İstemci Mantığı (app.js)
 * Doğal, ergonomik, donanım hissi veren market terminali kontrolcüsü
 */

// ===================== UYGULAMA DURUMU (STATE) ===================== //
const state = {
    cart: [],
    products: [],
    selectedCartIndex: -1,
    multiplier: 1,
    discount: { type: null, value: 0, code: null },
    isPriceCheckMode: false,
    activeCashier: { id: 1, name: "Ahmet Yılmaz", role: "Kıdemli Kasiyer" },
    activePaymentMethod: "Nakit",
    currentReceiptData: null
};

// ===================== MOBİL VE SES DESTEĞİ ===================== //
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
}

function focusInputSafely() {
    if (!isMobileDevice() && elements && elements.barkodInput) {
        elements.barkodInput.focus();
    }
}

// ===================== DOĞAL PARA BİRİMİ BİÇİMLENDİRME ===================== //
function formatTL(num) {
    return Number(num || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
}

// ===================== DOĞAL SES SENTEZLEYİCİSİ ===================== //
let audioCtx = null;
function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

// Gerçekçi Barkod Okuyucu Bip Sesi (Honeywell / Datalogic tarzı)
function playScanChirp() {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(2500, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1900, ctx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.04);
    } catch (e) {}
}

// Tuş Takımı Tıklama Sesi
function playKeyClick() {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.02);
    } catch (e) {}
}

// Kasa Çekmecesi ve Fiş Onay Sesi
function playRegisterSound() {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.setValueAtTime(freq, ctx.currentTime + (i * 0.07));
            gain.gain.setValueAtTime(0.08, ctx.currentTime + (i * 0.07));
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (i * 0.07) + 0.18);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + (i * 0.07));
            osc.stop(ctx.currentTime + (i * 0.07) + 0.2);
        });
    } catch (e) {}
}

// ===================== DOM ELEMENTLERİ ===================== //
const elements = {
    // Üst Bar
    aktifKasiyerAdi: document.getElementById('aktif-kasiyer-adi'),
    canliSaat: document.getElementById('canli-saat'),
    sepetSayac: document.getElementById('sepet-sayac'),
    barkodInput: document.getElementById('barkod-input'),
    adetCarpaniRozet: document.getElementById('adet-carpani-rozet'),

    // Fiyat Gör
    fiyatGorBar: document.getElementById('fiyat-gor-bar'),
    fiyatGorMesaj: document.getElementById('fiyat-gor-mesaj'),

    // Sepet & Fiş
    sepetGovde: document.getElementById('sepet-govde'),
    aktifFisNo: document.getElementById('aktif-fis-no'),
    ozetAraToplam: document.getElementById('ozet-ara-toplam'),
    indirimSatiri: document.getElementById('indirim-satiri'),
    indirimEtiketi: document.getElementById('indirim-etiketi'),
    ozetIndirim: document.getElementById('ozet-indirim'),
    ozetKdv: document.getElementById('ozet-kdv'),
    ozetGenelToplam: document.getElementById('ozet-genel-toplam'),

    // Hızlı Ürünler
    urunGrid: document.getElementById('urun-grid'),
    kategoriFiltreleri: document.getElementById('kategori-filtreleri'),

    // Sol Menü Butonları
    btnAnaSayfa: document.getElementById('btn-ana-sayfa'),
    btnSatis: document.getElementById('btn-satis'),
    btnIptal: document.getElementById('btn-iptal'),
    btnFiyat: document.getElementById('btn-fiyat'),
    btnBilet: document.getElementById('btn-bilet'),
    btnRapor: document.getElementById('btn-rapor'),
    btnSatici: document.getElementById('btn-satici'),

    // Numpad Tuşları
    btnSil: document.getElementById('btn-sil'),
    btnOnay: document.getElementById('btn-onay'),
    btnAdetCarpani: document.getElementById('btn-adet-carpani'),

    // Sağ Menü Butonları
    btnIndirim: document.getElementById('btn-indirim'),
    btnArtir: document.getElementById('btn-artir'),
    btnFisIptal: document.getElementById('btn-fis-iptal'),
    btnGiderPusula: document.getElementById('btn-gider-pusula'),
    btnHizliOdeme: document.getElementById('btn-hizli-odeme'),

    // Modallar
    modalOdeme: document.getElementById('modal-odeme'),
    modalTermalFis: document.getElementById('modal-termal-fis'),
    modalRapor: document.getElementById('modal-rapor'),
    modalIndirim: document.getElementById('modal-indirim'),
    modalBilet: document.getElementById('modal-bilet'),
    modalSatici: document.getElementById('modal-satici'),
    modalGider: document.getElementById('modal-gider'),
    toastMesaj: document.getElementById('toast-mesaj')
};

// ===================== BİLDİRİM (TOAST) ===================== //
let toastTimeout = null;
function showToast(message, type = 'bilgi') {
    clearTimeout(toastTimeout);
    elements.toastMesaj.textContent = message;
    elements.toastMesaj.className = `toast-kutusu ${type}`;
    elements.toastMesaj.style.display = 'block';

    toastTimeout = setTimeout(() => {
        elements.toastMesaj.style.display = 'none';
    }, 2400);
}

// ===================== DİJİTAL SAAT ===================== //
function startClock() {
    function update() {
        const now = new Date();
        elements.canliSaat.textContent = now.toLocaleTimeString('tr-TR');
    }
    update();
    setInterval(update, 1000);
}

// ===================== ÜRÜNLERİ BACKEND'DEN ÇEKME ===================== //
async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        const resData = await response.json();
        if (resData.success) {
            state.products = resData.data;
            renderProductGrid('hepsi');
        } else {
            showToast('Ürün listesi alınamadı: ' + resData.message, 'hata');
        }
    } catch (err) {
        showToast('Sunucu bağlantısı kurulamadı.', 'hata');
    }
}

// ===================== HIZLI ÜRÜN GRID RENDER ===================== //
function renderProductGrid(selectedCategory = 'hepsi') {
    elements.urunGrid.innerHTML = '';

    const filtered = selectedCategory === 'hepsi'
        ? state.products
        : state.products.filter(p => p.category === selectedCategory);

    if (filtered.length === 0) {
        elements.urunGrid.innerHTML = '<div class="yukleniyor-mesaj">Bu grupta ürün bulunmuyor.</div>';
        return;
    }

    filtered.forEach(product => {
        const card = document.createElement('div');
        card.className = 'urun-karti';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.innerHTML = `
            <div class="urun-karti-kategori">${product.category}</div>
            <div class="urun-karti-ad" title="${product.name}">${product.name}</div>
            <div class="urun-karti-fiyat">${formatTL(product.price)}</div>
            <div class="urun-karti-stok">Stok: ${product.stock} adet</div>
        `;

        card.addEventListener('click', () => {
            addProductToCart(product);
        });

        elements.urunGrid.appendChild(card);
    });
}

// ===================== SEPET YÖNETİMİ ===================== //
function addProductToCart(product, customQuantity = null) {
    playScanChirp();

    // Fiyat Gör modundaysa sadece bilgi ver
    if (state.isPriceCheckMode) {
        showPriceCheck(product);
        state.isPriceCheckMode = false;
        elements.fiyatGorBar.style.backgroundColor = 'var(--vfd-bg)';
        return;
    }

    const qtyToAdd = customQuantity !== null ? customQuantity : state.multiplier;
    const existingIndex = state.cart.findIndex(item => item.id === product.id);

    if (existingIndex > -1) {
        state.cart[existingIndex].quantity += qtyToAdd;
        state.cart[existingIndex].total = state.cart[existingIndex].quantity * state.cart[existingIndex].price;
        state.selectedCartIndex = existingIndex;
    } else {
        const newItem = {
            id: product.id,
            barcode: product.barcode,
            name: product.name,
            price: Number(product.price),
            vat: Number(product.vat || 10),
            quantity: qtyToAdd,
            total: qtyToAdd * Number(product.price)
        };
        state.cart.push(newItem);
        state.selectedCartIndex = state.cart.length - 1;
    }

    // Çarpanı varsayılana getir
    setMultiplier(1);
    elements.barkodInput.value = '';
    elements.barkodInput.focus();

    showPriceCheck(product);
    renderCart();
    showToast(`${qtyToAdd}x ${product.name} eklendi`, 'basari');
}

function showPriceCheck(product) {
    elements.fiyatGorMesaj.innerHTML = `${product.name} &nbsp;|&nbsp; Fiyat: <strong>${formatTL(product.price)}</strong> &nbsp;|&nbsp; Barkod: ${product.barcode} &nbsp;|&nbsp; Stok: ${product.stock} ad.`;
}

function removeSelectedItem() {
    if (state.cart.length === 0) {
        showToast('Sepette ürün bulunmuyor.', 'hata');
        return;
    }

    const indexToRemove = state.selectedCartIndex >= 0 ? state.selectedCartIndex : state.cart.length - 1;
    const removedItem = state.cart.splice(indexToRemove, 1)[0];

    playKeyClick();
    state.selectedCartIndex = state.cart.length - 1;
    renderCart();
    showToast(`${removedItem.name} fişten çıkarıldı.`, 'bilgi');
}

function increaseSelectedQuantity() {
    if (state.cart.length === 0) {
        showToast('Miktarı artırılacak ürün yok.', 'hata');
        return;
    }

    const targetIndex = state.selectedCartIndex >= 0 ? state.selectedCartIndex : state.cart.length - 1;
    state.cart[targetIndex].quantity += 1;
    state.cart[targetIndex].total = state.cart[targetIndex].quantity * state.cart[targetIndex].price;

    playKeyClick();
    renderCart();
    showToast(`${state.cart[targetIndex].name}: ${state.cart[targetIndex].quantity} adet`, 'basari');
}

function clearCart() {
    if (state.cart.length === 0) return;
    if (confirm('Aktif fişteki tüm ürünleri iptal etmek istediğinize emin misiniz?')) {
        state.cart = [];
        state.selectedCartIndex = -1;
        state.discount = { type: null, value: 0, code: null };
        setMultiplier(1);
        renderCart();
        showToast('Fiş iptal edildi.', 'bilgi');
    }
}

function calculateTotals() {
    const subtotal = state.cart.reduce((sum, item) => sum + item.total, 0);

    let discountAmount = 0;
    if (state.discount.type === 'percent') {
        discountAmount = (subtotal * state.discount.value) / 100;
    } else if (state.discount.type === 'amount') {
        discountAmount = Math.min(subtotal, state.discount.value);
    }

    const discountedSubtotal = Math.max(0, subtotal - discountAmount);

    let calculatedVat = 0;
    state.cart.forEach(item => {
        const itemVat = (item.total * (item.vat / 100));
        calculatedVat += itemVat;
    });

    const grandTotal = discountedSubtotal;

    return {
        subtotal,
        discountAmount,
        calculatedVat,
        grandTotal
    };
}

function renderCart() {
    elements.sepetGovde.innerHTML = '';
    const totals = calculateTotals();

    const totalItemCount = state.cart.reduce((sum, i) => sum + i.quantity, 0);
    elements.sepetSayac.textContent = totalItemCount;

    if (state.cart.length === 0) {
        elements.sepetGovde.innerHTML = `
            <tr class="bos-sepet-mesaj">
                <td colspan="6">Henüz ürün okutulmadı. Barkod tuşlayın veya sağdaki ürünlere dokunun.</td>
            </tr>
        `;
        elements.indirimSatiri.style.display = 'none';
        elements.ozetAraToplam.textContent = '0,00 TL';
        elements.ozetKdv.textContent = '0,00 TL';
        elements.ozetGenelToplam.textContent = '0,00 TL';
        return;
    }

    state.cart.forEach((item, index) => {
        const tr = document.createElement('tr');
        if (index === state.selectedCartIndex) {
            tr.classList.add('secili-satir');
        }

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${item.name}</strong><br><small style="color:#64748b; font-family:var(--font-mono);">${item.barcode}</small></td>
            <td><strong>${item.quantity}</strong></td>
            <td>${formatTL(item.price)}</td>
            <td><strong>${formatTL(item.total)}</strong></td>
            <td><button type="button" class="btn-sil-satir" data-sil="${index}" title="Satırı Çıkar">Sil</button></td>
        `;

        tr.addEventListener('click', (e) => {
            if (e.target.closest('.btn-sil-satir')) return;
            state.selectedCartIndex = index;
            renderCart();
        });

        const silBtn = tr.querySelector('.btn-sil-satir');
        silBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.cart.splice(index, 1);
            state.selectedCartIndex = Math.min(state.selectedCartIndex, state.cart.length - 1);
            renderCart();
        });

        elements.sepetGovde.appendChild(tr);
    });

    elements.sepetGovde.parentElement.scrollTop = elements.sepetGovde.parentElement.scrollHeight;

    // Özet Güncelle
    elements.ozetAraToplam.textContent = formatTL(totals.subtotal);
    elements.ozetKdv.textContent = formatTL(totals.calculatedVat);
    elements.ozetGenelToplam.textContent = formatTL(totals.grandTotal);

    if (totals.discountAmount > 0) {
        elements.indirimSatiri.style.display = 'flex';
        elements.indirimEtiketi.textContent = state.discount.code
            ? `İndirim (${state.discount.code}):`
            : `İndirim:`;
        elements.ozetIndirim.textContent = `-${formatTL(totals.discountAmount)}`;
    } else {
        elements.indirimSatiri.style.display = 'none';
    }
}

// ===================== NUMPAD TUŞ TAKIMI ===================== //
function handleNumpadKey(key) {
    playKeyClick();
    elements.barkodInput.value += key;
    focusInputSafely();
}

function handleBackspace() {
    playKeyClick();
    elements.barkodInput.value = elements.barkodInput.value.slice(0, -1);
    focusInputSafely();
}

function setMultiplier(val) {
    state.multiplier = Number(val);
    if (state.multiplier > 1) {
        elements.adetCarpaniRozet.textContent = `${state.multiplier}x`;
        elements.adetCarpaniRozet.classList.remove('gizli');
    } else {
        elements.adetCarpaniRozet.classList.add('gizli');
    }
}

function handleMultiplierKey() {
    playKeyClick();
    const currentVal = elements.barkodInput.value.trim();
    if (currentVal && !isNaN(currentVal) && Number(currentVal) > 0) {
        setMultiplier(parseInt(currentVal));
        elements.barkodInput.value = '';
        showToast(`${state.multiplier}x adet çarpanı seçildi`, 'bilgi');
    } else {
        setMultiplier(state.multiplier > 1 ? 1 : 2);
        showToast(`Adet çarpanı: ${state.multiplier}x`, 'bilgi');
    }
    focusInputSafely();
}

async function handleBarcodeSubmit() {
    const query = elements.barkodInput.value.trim();
    if (!query) return;

    try {
        const response = await fetch(`/api/products/${encodeURIComponent(query)}`);
        const resData = await response.json();

        if (resData.success && resData.data) {
            addProductToCart(resData.data);
        } else {
            showToast(resData.message || 'Ürün bulunamadı!', 'hata');
        }
    } catch (err) {
        showToast('Sorgulama hatası!', 'hata');
    }
}

// ===================== MODAL PENCERELERİ ===================== //
function openModal(modalEl) {
    modalEl.classList.remove('gizli');
}

function closeModal(modalEl) {
    modalEl.classList.add('gizli');
}

document.querySelectorAll('[data-kapat]').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-kapat');
        const modal = document.getElementById(targetId);
        if (modal) closeModal(modal);
    });
});

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-arkaplan')) {
        closeModal(e.target);
    }
});

// ===================== 1. ÖDEME VE SATIŞ ===================== //
function openPaymentModal() {
    if (state.cart.length === 0) {
        showToast('Sepette ürün yok. Önce ürün ekleyin.', 'hata');
        return;
    }

    const totals = calculateTotals();
    document.getElementById('modal-odeme-tutar').textContent = formatTL(totals.grandTotal);
    document.getElementById('alinan-para-input').value = totals.grandTotal.toFixed(2);
    calculateChange();
    openModal(elements.modalOdeme);
}

function calculateChange() {
    const totals = calculateTotals();
    const alinan = parseFloat(document.getElementById('alinan-para-input').value) || 0;
    const change = Math.max(0, alinan - totals.grandTotal);
    document.getElementById('para-ustu-deger').textContent = formatTL(change);
}

document.getElementById('alinan-para-input').addEventListener('input', calculateChange);

document.querySelectorAll('.odeme-tipi-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.odeme-tipi-btn').forEach(b => b.classList.remove('aktif'));
        btn.classList.add('aktif');
        state.activePaymentMethod = btn.getAttribute('data-odeme');

        const nakitAlani = document.getElementById('nakit-alani');
        nakitAlani.style.display = state.activePaymentMethod === 'Kredi Kartı' ? 'none' : 'block';
    });
});

document.querySelectorAll('.para-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tutarTip = btn.getAttribute('data-tutar');
        const totals = calculateTotals();
        if (tutarTip === 'tam') {
            document.getElementById('alinan-para-input').value = totals.grandTotal.toFixed(2);
        } else {
            document.getElementById('alinan-para-input').value = parseFloat(tutarTip).toFixed(2);
        }
        calculateChange();
    });
});

document.getElementById('btn-satisi-onayla').addEventListener('click', async () => {
    const totals = calculateTotals();
    const alinan = parseFloat(document.getElementById('alinan-para-input').value) || totals.grandTotal;

    if (state.activePaymentMethod === 'Nakit' && alinan < totals.grandTotal) {
        showToast('Alınan tutar toplam tutardan az olamaz!', 'hata');
        return;
    }

    const change = state.activePaymentMethod === 'Nakit' ? Math.max(0, alinan - totals.grandTotal) : 0;

    const salePayload = {
        cashier: `${state.activeCashier.name} (Kasa ${state.activeCashier.id})`,
        paymentMethod: state.activePaymentMethod,
        items: state.cart,
        subtotal: totals.subtotal,
        discount: totals.discountAmount,
        discountCode: state.discount.code,
        vatTotal: totals.calculatedVat,
        grandTotal: totals.grandTotal,
        paidAmount: alinan,
        change: change
    };

    try {
        const response = await fetch('/api/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(salePayload)
        });

        const resData = await response.json();
        if (resData.success) {
            closeModal(elements.modalOdeme);
            playRegisterSound();
            state.currentReceiptData = resData.data;

            showThermalReceipt(resData.data);

            state.cart = [];
            state.selectedCartIndex = -1;
            state.discount = { type: null, value: 0, code: null };
            setMultiplier(1);
            renderCart();

            loadProducts();
            showToast(`Satış tamamlandı: ${resData.data.id}`, 'basari');
        } else {
            showToast('Hata: ' + resData.message, 'hata');
        }
    } catch (err) {
        showToast('Ağ hatası oluştu!', 'hata');
    }
});

// ===================== 2. GERÇEKÇİ TERMAL SATIŞ FİŞİ ===================== //
function showThermalReceipt(sale) {
    const dateObj = new Date(sale.date);
    const dateFormatted = dateObj.toLocaleDateString('tr-TR');
    const timeFormatted = dateObj.toLocaleTimeString('tr-TR');
    let itemsHtml = '';

    sale.items.forEach(it => {
        itemsHtml += `
            <div class="fis-satir-duz">
                <span>${it.quantity} x ${it.name}</span>
                <span>${formatTL(it.total)}</span>
            </div>
        `;
    });

    const receiptHtml = `
        <div class="fis-baslik-merkez">
            <span class="fis-magaza-ad">MERT HELVA GIDA SAN. VE TİC. LTD. ŞTİ.</span>
            <small>Tarihi Helvacılar Çarşısı No: 12 Eminönü / İstanbul</small><br>
            <small>Tel: (0212) 520 19 84 - VKN: 6180492104</small><br>
            <small style="font-weight:600;">Geleneksel Taş Değirmen Lezzetleri</small>
        </div>
        <div class="fis-satir-duz">
            <span>Tarih: ${dateFormatted}</span>
            <span>Saat: ${timeFormatted}</span>
        </div>
        <div class="fis-satir-duz">
            <span>Fiş No: <strong>${sale.id}</strong></span>
            <span>Ödeme: ${sale.paymentMethod}</span>
        </div>
        <div class="fis-satir-duz">
            <span>Kasiyer: ${sale.cashier}</span>
        </div>
        <div class="fis-cizgi"></div>
        ${itemsHtml}
        <div class="fis-cizgi"></div>
        <div class="fis-satir-duz">
            <span>Ara Toplam:</span>
            <span>${formatTL(sale.subtotal)}</span>
        </div>
        ${sale.discount > 0 ? `
            <div class="fis-satir-duz" style="font-weight:bold;">
                <span>İndirim (${sale.discountCode || '%'}):</span>
                <span>-${formatTL(sale.discount)}</span>
            </div>
        ` : ''}
        <div class="fis-satir-duz">
            <span>Hesaplanan KDV:</span>
            <span>${formatTL(sale.vatTotal)}</span>
        </div>
        <div class="fis-cift-cizgi"></div>
        <div class="fis-satir-duz" style="font-size: 14px; font-weight: bold;">
            <span>TOPLAM TUTAR:</span>
            <span>${formatTL(sale.grandTotal)}</span>
        </div>
        <div class="fis-satir-duz">
            <span>Alınan:</span>
            <span>${formatTL(sale.paidAmount)}</span>
        </div>
        <div class="fis-satir-duz">
            <span>Para Üstü:</span>
            <span>${formatTL(sale.change)}</span>
        </div>
        <div class="fis-cizgi"></div>
        <div class="fis-tesekkur">
            MALİ DEĞERİ YOKTUR / BİLGİ FİŞİDİR<br>
            BİZİ TERCİH ETTİĞİNİZ İÇİN TEŞEKKÜR EDERİZ!
        </div>
    `;

    document.getElementById('termal-fis-cikti').innerHTML = receiptHtml;
    openModal(elements.modalTermalFis);
}

document.getElementById('btn-yazdir-fis').addEventListener('click', () => {
    window.print();
});

// ===================== 3. GÜN SONU / Z-RAPORU ===================== //
async function openDailyReportModal() {
    openModal(elements.modalRapor);
    const contentEl = document.getElementById('rapor-icerik');
    contentEl.innerHTML = '<div class="yukleniyor-mesaj">Rapor verileri hesaplanıyor...</div>';

    try {
        const response = await fetch('/api/reports/daily');
        const resData = await response.json();

        if (resData.success) {
            const sum = resData.summary;
            let topSellingHtml = '';
            resData.topSelling.forEach((item, idx) => {
                topSellingHtml += `
                    <div class="fis-satir-duz" style="padding: 5px 0; border-bottom: 1px dotted #e2e8f0;">
                        <span>${idx + 1}. ${item.name} (${item.quantity} adet)</span>
                        <strong>${formatTL(item.total)}</strong>
                    </div>
                `;
            });

            contentEl.innerHTML = `
                <div class="rapor-grid">
                    <div class="rapor-kart rapor-kart-vurgulu">
                        <div class="rapor-kart-baslik">Toplam Ciro</div>
                        <div class="rapor-kart-deger">${formatTL(sum.totalRevenue)}</div>
                    </div>
                    <div class="rapor-kart">
                        <div class="rapor-kart-baslik">Fiş Sayısı</div>
                        <div class="rapor-kart-deger">${sum.totalSalesCount}</div>
                    </div>
                    <div class="rapor-kart">
                        <div class="rapor-kart-baslik">Nakit Hasılat</div>
                        <div class="rapor-kart-deger">${formatTL(sum.cashTotal)}</div>
                    </div>
                    <div class="rapor-kart">
                        <div class="rapor-kart-baslik">Kart Hasılat</div>
                        <div class="rapor-kart-deger">${formatTL(sum.cardTotal)}</div>
                    </div>
                    <div class="rapor-kart">
                        <div class="rapor-kart-baslik">Toplam Gider</div>
                        <div class="rapor-kart-deger" style="color: #dc2626;">-${formatTL(sum.totalExpenses)}</div>
                    </div>
                    <div class="rapor-kart rapor-kart-vurgulu">
                        <div class="rapor-kart-baslik">Kasada Net Nakit</div>
                        <div class="rapor-kart-deger">${formatTL(sum.netCashInDrawer)}</div>
                    </div>
                </div>

                <div style="margin-top: 14px;">
                    <h4 style="font-size: 13px; color: #334155; margin-bottom: 8px;">En Çok Satan Ürünler</h4>
                    ${topSellingHtml || '<div style="color:#64748b; font-size:12px;">Henüz satış bulunmuyor.</div>'}
                </div>
            `;
        } else {
            contentEl.innerHTML = `<div class="hata-mesaj">${resData.message}</div>`;
        }
    } catch (err) {
        contentEl.innerHTML = '<div class="hata-mesaj">Rapor verileri alınamadı.</div>';
    }
}

document.getElementById('btn-yazdir-rapor').addEventListener('click', () => {
    window.print();
});

// ===================== 4. İNDİRİM UYGULAMA ===================== //
let activeDiscountType = 'yuzde';

document.querySelectorAll('.indirim-tur-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.indirim-tur-btn').forEach(b => b.classList.remove('aktif'));
        btn.classList.add('aktif');
        activeDiscountType = btn.getAttribute('data-tur');
    });
});

document.querySelectorAll('.hizli-ind-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.getElementById('indirim-degeri-input').value = btn.getAttribute('data-val');
    });
});

document.getElementById('btn-uygula-indirim').addEventListener('click', () => {
    const val = parseFloat(document.getElementById('indirim-degeri-input').value);
    if (!val || val <= 0) {
        showToast('Geçerli bir indirim değeri girin.', 'hata');
        return;
    }

    state.discount = {
        type: activeDiscountType === 'yuzde' ? 'percent' : 'amount',
        value: val,
        code: null
    };

    closeModal(elements.modalIndirim);
    renderCart();
    showToast(`İndirim uygulandı: ${activeDiscountType === 'yuzde' ? '%' + val : formatTL(val)}`, 'basari');
});

// ===================== 5. BİLET & KUPON ===================== //
document.getElementById('btn-onayla-bilet').addEventListener('click', async () => {
    const code = document.getElementById('kupon-kodu-input').value.trim();
    if (!code) {
        showToast('Lütfen bir kod giriniz.', 'hata');
        return;
    }

    try {
        const response = await fetch('/api/coupons/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });

        const resData = await response.json();
        if (resData.success) {
            state.discount = {
                type: resData.data.type,
                value: resData.data.value,
                code: resData.data.code
            };
            closeModal(elements.modalBilet);
            renderCart();
            playRegisterSound();
            showToast(`${resData.data.description} uygulandı`, 'basari');
        } else {
            showToast(resData.message, 'hata');
        }
    } catch (err) {
        showToast('Kupon doğrulanamadı.', 'hata');
    }
});

// ===================== 6. KASİYER SEÇİMİ ===================== //
async function openCashierModal() {
    openModal(elements.modalSatici);
    const listEl = document.getElementById('kasiyer-secim-listesi');
    listEl.innerHTML = '<div class="yukleniyor-mesaj">Kasiyerler yükleniyor...</div>';

    try {
        const response = await fetch('/api/cashiers');
        const resData = await response.json();

        if (resData.success) {
            listEl.innerHTML = '';
            resData.data.forEach(c => {
                const card = document.createElement('div');
                card.className = `kasiyer-kart-secim ${c.id === state.activeCashier.id ? 'aktif' : ''}`;
                card.innerHTML = `
                    <div>
                        <strong>${c.name}</strong>
                        <div style="font-size: 11px; color: #64748b;">${c.role} | Vardiya: ${c.shift}</div>
                    </div>
                    <span style="font-weight: 700; color: #2563eb; font-family: var(--font-mono);">Kasa ${c.code}</span>
                `;

                card.addEventListener('click', () => {
                    state.activeCashier = c;
                    elements.aktifKasiyerAdi.textContent = `${c.name} (Kasa ${c.id})`;
                    closeModal(elements.modalSatici);
                    showToast(`Kasiyer: ${c.name}`, 'basari');
                });

                listEl.appendChild(card);
            });
        }
    } catch (e) {
        listEl.innerHTML = '<div class="hata-mesaj">Kasiyer listesi yüklenemedi.</div>';
    }
}

// ===================== 7. GİDER PUSULASI ===================== //
document.getElementById('btn-kaydet-gider').addEventListener('click', async () => {
    const category = document.getElementById('gider-kategori-select').value;
    const amount = parseFloat(document.getElementById('gider-tutar-input').value);
    const description = document.getElementById('gider-aciklama-input').value.trim();

    if (!amount || amount <= 0) {
        showToast('Geçerli bir gider tutarı girin.', 'hata');
        return;
    }

    try {
        const response = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cashier: `${state.activeCashier.name} (Kasa ${state.activeCashier.id})`,
                category,
                amount,
                description
            })
        });

        const resData = await response.json();
        if (resData.success) {
            closeModal(elements.modalGider);
            document.getElementById('gider-tutar-input').value = '';
            document.getElementById('gider-aciklama-input').value = '';
            showToast(`Gider kaydedildi: ${formatTL(amount)}`, 'basari');
        } else {
            showToast('Hata: ' + resData.message, 'hata');
        }
    } catch (e) {
        showToast('Gider kaydedilemedi.', 'hata');
    }
});

// ===================== OLAY DİNLEYİCİLERİ ===================== //

// Sol Menü
elements.btnAnaSayfa.addEventListener('click', () => {
    setMultiplier(1);
    state.isPriceCheckMode = false;
    elements.fiyatGorBar.style.backgroundColor = 'var(--vfd-bg)';
    elements.barkodInput.value = '';
    renderProductGrid('hepsi');
    showToast('Ana ekrana dönüldü', 'bilgi');
});

elements.btnSatis.addEventListener('click', openPaymentModal);
elements.btnIptal.addEventListener('click', removeSelectedItem);

elements.btnFiyat.addEventListener('click', () => {
    state.isPriceCheckMode = !state.isPriceCheckMode;
    if (state.isPriceCheckMode) {
        elements.fiyatGorBar.style.backgroundColor = '#162a1c';
        showToast('Fiyat Gör modu aktif: Okutulan ürün sepete eklenmez', 'bilgi');
    } else {
        elements.fiyatGorBar.style.backgroundColor = 'var(--vfd-bg)';
        showToast('Normal satış modu aktif', 'bilgi');
    }
});

elements.btnBilet.addEventListener('click', () => openModal(elements.modalBilet));
elements.btnRapor.addEventListener('click', openDailyReportModal);
elements.btnSatici.addEventListener('click', openCashierModal);

// Sağ Menü
elements.btnIndirim.addEventListener('click', () => openModal(elements.modalIndirim));
elements.btnArtir.addEventListener('click', increaseSelectedQuantity);
elements.btnFisIptal.addEventListener('click', clearCart);
elements.btnGiderPusula.addEventListener('click', () => openModal(elements.modalGider));
elements.btnHizliOdeme.addEventListener('click', openPaymentModal);

// Numpad
document.querySelectorAll('.sayi[data-tus]').forEach(btn => {
    btn.addEventListener('click', () => {
        handleNumpadKey(btn.getAttribute('data-tus'));
    });
});

elements.btnSil.addEventListener('click', handleBackspace);
elements.btnOnay.addEventListener('click', handleBarcodeSubmit);
elements.btnAdetCarpani.addEventListener('click', handleMultiplierKey);

// Fiziksel Klavye & Barkod Okuyucu Desteği
window.addEventListener('keydown', (e) => {
    if (e.target !== elements.barkodInput && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
        return;
    }

    if (e.key === 'Enter') {
        e.preventDefault();
        handleBarcodeSubmit();
    } else if (e.key === 'Backspace' && e.target !== elements.barkodInput) {
        handleBackspace();
    } else if (e.key === '*') {
        e.preventDefault();
        handleMultiplierKey();
    }
});

// Kategori Filtreleri
elements.kategoriFiltreleri.querySelectorAll('.kategori-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        elements.kategoriFiltreleri.querySelectorAll('.kategori-btn').forEach(b => b.classList.remove('aktif'));
        btn.classList.add('aktif');
        renderProductGrid(btn.getAttribute('data-kategori'));
    });
});

// Başlangıç
document.addEventListener('DOMContentLoaded', () => {
    startClock();
    loadProducts();
    renderCart();
    focusInputSafely();
});
