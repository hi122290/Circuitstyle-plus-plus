/**
 * Canvas-rendered HUD elements.
 */

export function renderHealthBar(health) {
    const canvasEl = document.getElementById('health-bar-canvas');
    if (!canvasEl) return;
    const W = 212;
    const H = 20;
    if (canvasEl.width !== W || canvasEl.height !== H) {
        canvasEl.width = W;
        canvasEl.height = H;
    }

    const ctx = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const ratio = Math.max(0, Math.min(1, health / 100));
    ctx.fillStyle = '#180000';
    ctx.fillRect(2, 2, W - 4, H - 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(3, 3, W - 6, H - 6);
    ctx.fillStyle = '#5f0000';
    ctx.fillRect(5, 5, W - 10, H - 10);
    const fillW = Math.ceil((W - 10) * ratio);
    const gradient = ctx.createLinearGradient(5, 0, 5 + fillW, 0);
    gradient.addColorStop(0, '#ff4d5a');
    gradient.addColorStop(1, '#7d0008');
    ctx.fillStyle = gradient;
    ctx.fillRect(5, 5, fillW, H - 10);
}

export function renderPlayerList(players = []) {
    const canvasEl = document.getElementById('player-list-canvas');
    if (!canvasEl) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const displayW = Math.max(260, Math.floor(canvasEl.clientWidth || 300));
    const rowHeight = 30;
    const headerHeight = 46;
    const columnHeight = 28;
    const padding = 14;
    const logicalH = Math.min(600, headerHeight + columnHeight + Math.max(1, players.length) * rowHeight + padding);
    const W = Math.floor(displayW * dpr);
    const H = Math.floor(logicalH * dpr);
    if (canvasEl.width !== W || canvasEl.height !== H) {
        canvasEl.width = W;
        canvasEl.height = H;
    }

    const ctx = canvasEl.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, displayW, logicalH);
    ctx.textBaseline = 'middle';

    ctx.fillStyle = 'rgba(8, 16, 31, 0.92)';
    ctx.fillRect(1, 1, displayW - 2, logicalH - 2);
    ctx.strokeStyle = '#67d9ff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(1.75, 1.75, displayW - 3.5, logicalH - 3.5);

    ctx.fillStyle = '#67d9ff';
    ctx.font = '700 15px Arial, Helvetica, sans-serif';
    ctx.fillText('PLAYERS', padding, 24);
    ctx.fillStyle = 'rgba(103, 217, 255, 0.14)';
    ctx.fillRect(1, headerHeight - 1, displayW - 2, columnHeight);

    const nameX = padding;
    const killsX = displayW - 108;
    const wipeoutsX = displayW - 52;
    ctx.font = '700 10px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#9bb6ca';
    ctx.fillText('PLAYER', nameX, headerHeight + columnHeight / 2);
    ctx.textAlign = 'center';
    ctx.fillText('KILLS', killsX, headerHeight + columnHeight / 2);
    ctx.fillText('WIPEOUTS', wipeoutsX, headerHeight + columnHeight / 2);

    ctx.font = '600 13px Arial, Helvetica, sans-serif';
    for (let i = 0; i < players.length; i++) {
        const p = players[i] || {};
        const y = headerHeight + columnHeight + i * rowHeight;
        if (y + rowHeight > logicalH) break;
        if (i % 2 === 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
            ctx.fillRect(2, y, displayW - 4, rowHeight);
        }
        ctx.strokeStyle = 'rgba(145, 184, 205, 0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(2, y + rowHeight);
        ctx.lineTo(displayW - 2, y + rowHeight);
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillStyle = p.color || '#ffffff';
        const originalName = String(p.name || 'Guest');
        let name = originalName;
        while (name.length > 20 && ctx.measureText(`${name}…`).width > killsX - nameX - 16) name = name.slice(0, -1);
        if (name.length < originalName.length) name += '…';
        ctx.fillText(name, nameX, y + rowHeight / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#eef8ff';
        ctx.fillText(String(Math.max(0, Number(p.kills) || 0)), killsX, y + rowHeight / 2);
        ctx.fillText(String(Math.max(0, Number(p.wipeouts) || 0)), wipeoutsX, y + rowHeight / 2);
    }

    ctx.textAlign = 'left';
    try {
        window.dispatchEvent(new CustomEvent('playerListUpdated', { detail: players }));
    } catch (e) {}
}
