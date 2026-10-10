/**
 * POS Kasa Satış Terminali - Backend Sunucusu (SQL Destekli)
 * Mimari: Express.js REST API + SQLite (node:sqlite DatabaseSync)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Ana Sayfa Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ===================== SQL VERİTABANI BAĞLANTISI ===================== //
const DB_PATH = path.join(__dirname, 'pos_market.db');
const db = new DatabaseSync(DB_PATH);

// Tabloları Oluştur (Schema Migration)
function initDatabase() {
    db.exec(`
        -- Ürünler Tablosu
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            barcode TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL,
            vat INTEGER DEFAULT 10,
            stock INTEGER DEFAULT 100,
            icon TEXT DEFAULT '📦'
        );

        -- Satış Fişleri Tablosu
        CREATE TABLE IF NOT EXISTS sales (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            cashier TEXT NOT NULL,
            payment_method TEXT NOT NULL,
            subtotal REAL NOT NULL,
            discount REAL DEFAULT 0,
            discount_code TEXT,
            vat_total REAL DEFAULT 0,
            grand_total REAL NOT NULL,
            paid_amount REAL NOT NULL,
            change_amount REAL DEFAULT 0
        );

        -- Fiş Kalemleri (Detay) Tablosu
        CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id TEXT NOT NULL,
            product_id INTEGER,
            barcode TEXT NOT NULL,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            quantity INTEGER NOT NULL,
            total REAL NOT NULL,
            vat INTEGER DEFAULT 10,
            FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
        );

        -- Gider Pusulaları Tablosu
        CREATE TABLE IF NOT EXISTS expenses (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            cashier TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            amount REAL NOT NULL
        );

        -- İndirim Kuponları & Biletler Tablosu
        CREATE TABLE IF NOT EXISTS coupons (
            code TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            value REAL NOT NULL,
            description TEXT NOT NULL
        );

        -- Kasiyerler Tablosu
        CREATE TABLE IF NOT EXISTS cashiers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT NOT NULL UNIQUE,
            role TEXT NOT NULL,
            shift TEXT NOT NULL
        );
    `);

    seedInitialData();
}

// Başlangıç Verilerini SQL Tablolarına Yükleme (Seed Data)
function seedInitialData() {
    // 1. Kasiyerler
    const cashierCount = db.prepare('SELECT COUNT(*) as count FROM cashiers').get().count;
    if (cashierCount === 0) {
        const insertCashier = db.prepare('INSERT INTO cashiers (name, code, role, shift) VALUES (?, ?, ?, ?)');
        insertCashier.run('Ahmet Yılmaz', '1', 'Kıdemli Kasiyer', 'Sabah');
        insertCashier.run('Ayşe Kaya', '2', 'Kasiyer', 'Öğle');
        insertCashier.run('Mehmet Demir', '3', 'Stajyer Kasiyer', 'Akşam');
    }

    // 2. Kuponlar (Mert Helva Kampanyaları)
    const couponCount = db.prepare('SELECT COUNT(*) as count FROM coupons').get().count;
    if (couponCount === 0) {
        const insertCoupon = db.prepare('INSERT INTO coupons (code, type, value, description) VALUES (?, ?, ?, ?)');
        insertCoupon.run('MERTHELVA10', 'percent', 10, '%10 Mert Helva Tanışma İndirimi');
        insertCoupon.run('TAHIN15', 'percent', 15, '%15 Tahin & Helva Kampanyası');
        insertCoupon.run('LEZZET20', 'percent', 20, '%20 Geleneksel Lezzet İndirimi');
        insertCoupon.run('HEDIYE50', 'amount', 50, '50 TL Mert Helva Hediye Çeki');
        insertCoupon.run('INDIRIM10', 'percent', 10, '%10 Genel İndirim');
    }

    // 3. Mert Helva Ürün Kataloğu
    const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    if (productCount === 0) {
        const insertProduct = db.prepare(`
            INSERT INTO products (barcode, name, category, price, vat, stock, icon)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const initialProducts = [
            // Tahin Helvaları
            ['869741001001', 'Mert Kakaolu Tahin Helvası 500g', 'Tahin Helvaları', 85.00, 1, 120, ''],
            ['869741001002', 'Mert Sade Tahin Helvası 500g', 'Tahin Helvaları', 80.00, 1, 140, ''],
            ['869741001003', 'Mert Antep Fıstıklı Tahin Helvası 500g', 'Tahin Helvaları', 135.00, 1, 90, ''],
            ['869741001004', 'Mert Blok Kürek Helvası (Cevizli) 1kg', 'Tahin Helvaları', 190.00, 1, 45, ''],
            ['869741001005', 'Mert Yaz Helvası (Kakaolu & Fındıklı) 400g', 'Tahin Helvaları', 75.00, 1, 80, ''],
            ['869741001006', 'Mert Sıcak Fırın Helvası 250g', 'Tahin Helvaları', 65.00, 1, 60, ''],
            ['869741001007', 'Mert Sade Tahin Helvası 1kg (Kutu)', 'Tahin Helvaları', 150.00, 1, 50, ''],
            
            // Tahin & Pekmez
            ['869741002001', 'Mert Taş Değirmen Çifte Kavrulmuş Tahin 600g', 'Tahin & Pekmez', 120.00, 1, 95, ''],
            ['869741002002', 'Mert Beyaz Yerli Susam Tahini 600g', 'Tahin & Pekmez', 110.00, 1, 85, ''],
            ['869741002003', 'Mert Doğal Üzüm Pekmezi 800g', 'Tahin & Pekmez', 115.00, 1, 70, ''],
            ['869741002004', 'Mert Dut Pekmezi (Geleneksel) 800g', 'Tahin & Pekmez', 130.00, 1, 65, ''],
            ['869741002005', 'Mert Harnup (Keçiboynuzu) Özü 650g', 'Tahin & Pekmez', 140.00, 1, 50, ''],
            ['869741002006', 'Mert Tahin & Üzüm Pekmezi İkili Set', 'Tahin & Pekmez', 220.00, 1, 40, ''],

            // Lokum & Şekerleme
            ['869741003001', 'Mert Çifte Kavrulmuş Antep Fıstıklı Lokum 500g', 'Lokum & Şekerleme', 160.00, 10, 75, ''],
            ['869741003002', 'Mert Güllü Sultan Lokumu 400g', 'Lokum & Şekerleme', 75.00, 10, 90, ''],
            ['869741003003', 'Mert Nar & Fıstıklı Fitil Lokum 350g', 'Lokum & Şekerleme', 125.00, 10, 60, ''],
            ['869741003004', 'Mert Damla Sakızlı Akide Şekeri 300g', 'Lokum & Şekerleme', 55.00, 10, 110, ''],
            ['869741003005', 'Mert Tarçınlı & Zencefilli Akide Şekeri 300g', 'Lokum & Şekerleme', 55.00, 10, 100, ''],
            ['869741003006', 'Mert Cevizli Paşa Lokumu 500g', 'Lokum & Şekerleme', 140.00, 10, 55, ''],

            // Reçel & Bal
            ['869741004001', 'Mert Dağ Çileği Reçeli 380g', 'Reçel & Bal', 70.00, 1, 80, ''],
            ['869741004002', 'Mert Karadut Reçeli 380g', 'Reçel & Bal', 75.00, 1, 75, ''],
            ['869741004003', 'Mert Bergamot & Portakal Reçeli 380g', 'Reçel & Bal', 68.00, 1, 65, ''],
            ['869741004004', 'Mert Yayla Ham Çiçek Balı 850g', 'Reçel & Bal', 260.00, 1, 35, '']
        ];

        initialProducts.forEach(p => insertProduct.run(...p));
    }
}

// Veritabanını başlat
initDatabase();

// ===================== REST API ENDPOINT'LERİ (SQL) ===================== //

// 1. Tüm Ürünleri Listele (SQL SELECT)
app.get('/api/products', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM products ORDER BY name ASC');
        const products = stmt.all();
        res.json({ success: true, count: products.length, data: products });
    } catch (err) {
        res.status(500).json({ success: false, message: 'SQL Hatası: ' + err.message });
    }
});

// 2. Barkod ile Ürün Sorgula (SQL SELECT WHERE)
app.get('/api/products/:barcode', (req, res) => {
    try {
        const barcode = req.params.barcode.trim();
        const stmt = db.prepare('SELECT * FROM products WHERE barcode = ? OR CAST(id AS TEXT) = ?');
        const product = stmt.get(barcode, barcode);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: `"${barcode}" barkodlu ürün veritabanında bulunamadı.`
            });
        }

        res.json({ success: true, data: product });
    } catch (err) {
        res.status(500).json({ success: false, message: 'SQL Hatası: ' + err.message });
    }
});

// 3. Yeni Ürün Ekle (SQL INSERT)
app.post('/api/products', (req, res) => {
    try {
        const { barcode, name, category, price, vat, stock, icon } = req.body;

        if (!barcode || !name || price === undefined) {
            return res.status(400).json({ success: false, message: "Barkod, ad ve fiyat zorunludur." });
        }

        const existing = db.prepare('SELECT id FROM products WHERE barcode = ?').get(barcode);
        if (existing) {
            return res.status(409).json({ success: false, message: "Bu barkoda sahip bir ürün zaten kayıtlı." });
        }

        const insert = db.prepare(`
            INSERT INTO products (barcode, name, category, price, vat, stock, icon)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const result = insert.run(
            barcode,
            name,
            category || 'Genel',
            Number(price),
            vat !== undefined ? Number(vat) : 10,
            stock !== undefined ? Number(stock) : 100,
            icon || '📦'
        );

        const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json({ success: true, message: "Ürün başarıyla SQL veritabanına eklendi.", data: newProduct });
    } catch (err) {
        res.status(500).json({ success: false, message: 'SQL Hatası: ' + err.message });
    }
});

// 4. Satış Yap / Fiş Kes (SQL TRANSACTION & INSERT & UPDATE)
app.post('/api/sales', (req, res) => {
    try {
        const { cashier, paymentMethod, items, subtotal, discount, discountCode, vatTotal, grandTotal, paidAmount, change } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "Sepette satışı yapılacak ürün yok." });
        }

        // Fiş No üretimi (SQL COUNT veya MAX)
        const lastSale = db.prepare('SELECT id FROM sales ORDER BY rowid DESC LIMIT 1').get();
        let nextNum = 1001;
        if (lastSale && lastSale.id && lastSale.id.startsWith('FIS-')) {
            nextNum = parseInt(lastSale.id.replace('FIS-', '')) + 1;
        }
        const receiptId = `FIS-${nextNum}`;
        const saleDate = new Date().toISOString();

        // 1. Ana Fiş Kaydı
        const insertSale = db.prepare(`
            INSERT INTO sales (id, date, cashier, payment_method, subtotal, discount, discount_code, vat_total, grand_total, paid_amount, change_amount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertSale.run(
            receiptId,
            saleDate,
            cashier || 'Kasiyer 1 (Ahmet Yılmaz)',
            paymentMethod || 'Nakit',
            Number(subtotal || grandTotal),
            Number(discount || 0),
            discountCode || null,
            Number(vatTotal || 0),
            Number(grandTotal),
            Number(paidAmount || grandTotal),
            Number(change || 0)
        );

        // 2. Fiş Kalemleri ve Stok Düşme
        const insertItem = db.prepare(`
            INSERT INTO sale_items (sale_id, product_id, barcode, name, price, quantity, total, vat)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const updateStock = db.prepare(`
            UPDATE products SET stock = MAX(0, stock - ?) WHERE barcode = ? OR id = ?
        `);

        items.forEach(it => {
            insertItem.run(
                receiptId,
                it.id || null,
                it.barcode,
                it.name,
                Number(it.price),
                Number(it.quantity),
                Number(it.total),
                Number(it.vat || 10)
            );
            updateStock.run(Number(it.quantity), it.barcode, it.id || 0);
        });

        const createdSale = {
            id: receiptId,
            date: saleDate,
            cashier: cashier || 'Kasiyer 1 (Ahmet Yılmaz)',
            paymentMethod: paymentMethod || 'Nakit',
            items,
            subtotal: Number(subtotal || grandTotal),
            discount: Number(discount || 0),
            discountCode: discountCode || null,
            vatTotal: Number(vatTotal || 0),
            grandTotal: Number(grandTotal),
            paidAmount: Number(paidAmount || grandTotal),
            change: Number(change || 0)
        };

        res.status(201).json({
            success: true,
            message: "Satış SQL veritabanına başarıyla kaydedildi.",
            data: createdSale
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'SQL Satış Hatası: ' + err.message });
    }
});

// 5. Geçmiş Satışlar (SQL SELECT)
app.get('/api/sales', (req, res) => {
    try {
        const sales = db.prepare('SELECT * FROM sales ORDER BY date DESC').all();
        const getItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?');

        const fullSales = sales.map(s => ({
            ...s,
            items: getItems.all(s.id)
        }));

        res.json({ success: true, count: fullSales.length, data: fullSales });
    } catch (err) {
        res.status(500).json({ success: false, message: 'SQL Hatası: ' + err.message });
    }
});

// 6. Gün Sonu / Z-Raporu (SQL AGGREGATION - SUM, COUNT, GROUP BY)
app.get('/api/reports/daily', (req, res) => {
    try {
        // Satış istatistikleri
        const summaryStat = db.prepare(`
            SELECT 
                COUNT(*) as totalSalesCount,
                COALESCE(SUM(grand_total), 0) as totalRevenue,
                COALESCE(SUM(discount), 0) as totalDiscount,
                COALESCE(SUM(vat_total), 0) as totalVat
            FROM sales
        `).get();

        // Nakit ve Kart Dağılımı
        const cashStat = db.prepare(`
            SELECT COALESCE(SUM(grand_total), 0) as total FROM sales WHERE payment_method = 'Nakit'
        `).get().total;

        const cardStat = db.prepare(`
            SELECT COALESCE(SUM(grand_total), 0) as total FROM sales WHERE payment_method = 'Kredi Kartı'
        `).get().total;

        // Giderler
        const expenseStat = db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as total FROM expenses
        `).get().total;

        // En Çok Satan 5 Ürün (SQL GROUP BY)
        const topSelling = db.prepare(`
            SELECT name, SUM(quantity) as quantity, SUM(total) as total
            FROM sale_items
            GROUP BY name
            ORDER BY quantity DESC
            LIMIT 5
        `).all();

        // Son Giderler
        const recentExpenses = db.prepare('SELECT * FROM expenses ORDER BY date DESC LIMIT 5').all();

        const netCash = Math.max(0, cashStat - expenseStat);

        res.json({
            success: true,
            reportDate: new Date().toLocaleDateString('tr-TR'),
            generatedAt: new Date().toISOString(),
            summary: {
                totalSalesCount: summaryStat.totalSalesCount,
                totalRevenue: Number(summaryStat.totalRevenue.toFixed(2)),
                cashTotal: Number(cashStat.toFixed(2)),
                cardTotal: Number(cardStat.toFixed(2)),
                totalDiscount: Number(summaryStat.totalDiscount.toFixed(2)),
                totalVat: Number(summaryStat.totalVat.toFixed(2)),
                totalExpenses: Number(expenseStat.toFixed(2)),
                netCashInDrawer: Number(netCash.toFixed(2))
            },
            topSelling,
            recentExpenses
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'SQL Rapor Hatası: ' + err.message });
    }
});

// 7. Kupon Doğrulama (SQL SELECT WHERE)
app.post('/api/coupons/validate', (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ success: false, message: "Kupon kodu belirtilmedi." });
        }

        const cleanCode = code.trim().toUpperCase();
        const coupon = db.prepare('SELECT * FROM coupons WHERE code = ?').get(cleanCode);

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: `"${cleanCode}" geçerli bir kupon veya bilet kodu değil.`
            });
        }

        res.json({
            success: true,
            message: `${coupon.description} uygulandı!`,
            data: coupon
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'SQL Hatası: ' + err.message });
    }
});

// 8. Gider Pusulası Kaydı (SQL INSERT)
app.post('/api/expenses', (req, res) => {
    try {
        const { cashier, category, description, amount } = req.body;

        if (!category || !amount || Number(amount) <= 0) {
            return res.status(400).json({ success: false, message: "Gider kategorisi ve geçerli bir tutar zorunludur." });
        }

        const lastExp = db.prepare('SELECT id FROM expenses ORDER BY rowid DESC LIMIT 1').get();
        let nextNum = 5001;
        if (lastExp && lastExp.id && lastExp.id.startsWith('GDP-')) {
            nextNum = parseInt(lastExp.id.replace('GDP-', '')) + 1;
        }

        const expenseId = `GDP-${nextNum}`;
        const expDate = new Date().toISOString();

        const insertExp = db.prepare(`
            INSERT INTO expenses (id, date, cashier, category, description, amount)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        insertExp.run(
            expenseId,
            expDate,
            cashier || 'Kasiyer 1 (Ahmet Yılmaz)',
            category,
            description || 'Belirtilmedi',
            Number(amount)
        );

        const newExpense = {
            id: expenseId,
            date: expDate,
            cashier: cashier || 'Kasiyer 1 (Ahmet Yılmaz)',
            category,
            description: description || 'Belirtilmedi',
            amount: Number(amount)
        };

        res.status(201).json({
            success: true,
            message: "Gider pusulası SQL veritabanına işlendi.",
            data: newExpense
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'SQL Gider Hatası: ' + err.message });
    }
});

// 9. Kasiyer Listesi (SQL SELECT)
app.get('/api/cashiers', (req, res) => {
    try {
        const cashiers = db.prepare('SELECT * FROM cashiers ORDER BY id ASC').all();
        res.json({ success: true, data: cashiers });
    } catch (err) {
        res.status(500).json({ success: false, message: 'SQL Hatası: ' + err.message });
    }
});

// Sunucuyu Başlat
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🍯 Mert Helva - POS Kasa Satış Terminali Yayında!`);
    console.log(`🗄️  SQL Veritabanı: ${DB_PATH}`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`💻 Zaman: ${new Date().toLocaleString('tr-TR')}`);
    console.log(`====================================================`);
});
