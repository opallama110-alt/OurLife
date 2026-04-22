import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const folders = ['./public/assets/anatomy/front', './public/assets/anatomy/back'];

console.log('⚔️ Memulai Operasi Pembersihan SVG Massal...');

folders.forEach(folder => {
    if (!fs.existsSync(folder)) {
        console.log(`Folder tidak ditemukan: ${folder}`);
        return;
    }

    const files = fs.readdirSync(folder);

    files.forEach(file => {
        // Jangan sentuh file BaseBody!
        if (!file.endsWith('.svg') || file === 'BaseBody.svg') return;

        const filePath = path.join(folder, file);
        let content = fs.readFileSync(filePath, 'utf8');

        // Load SVG ke cheerio
        const $ = cheerio.load(content, { xmlMode: true });

        // 1. AMPUTASI HANTU BADAN POLOS (Layer yang depannya "Front_" atau "Back_")
        $('[id^="Front_"]').remove();
        $('[id^="Back_"]').remove();

        // 2. WARNAIN OTOT JADI MERAH SEMPURNA (Ubah semua class bawaan Illustrator jadi fill merah)
        $('[class^="st"]').attr('fill', '#e63946').removeAttr('class');

        // Save ulang filenya
        fs.writeFileSync(filePath, $.xml(), 'utf8');
        console.log(`✅ Bersih & Merah: ${file}`);
    });
});

console.log('🏆 OPERASI SELESAI! Semua otot siap ditumpuk!');