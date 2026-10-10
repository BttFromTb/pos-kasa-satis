@echo off
chcp 65001 >nul
echo ===================================================
echo   🛒 POS KASA SATIŞ TERMİNALİ BAŞLATILIYOR...
echo ===================================================
echo.
echo Proje bagimliliklari kontrol ediliyor...
if not exist node_modules (
    echo Moduller yukleniyor, lutfen bekleyin...
    npm install
)

echo.
echo Sunucu calistiriliyor...
echo Tarayicinizda http://localhost:3000 adresini acin.
echo Kapatmak icin CTRL + C tuslarina basin.
echo ===================================================
node server.js
pause
