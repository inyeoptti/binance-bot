// src/modules/notifier.js
import axios from 'axios';
import { config } from '../config.js';

const { discord: { webhookUrl } } = config;

/**
 * Discord에 메시지를 전송합니다.
 * @param {string} content 전송할 메시지 내용
 * @param {boolean} isImportant 중요한 알림이면 @here 멘션 포함
 */
async function sendDiscord(content, isImportant = false) {
    try {
        const payload = {
            content: isImportant ? `@here\n${content}` : content
        };
        await axios.post(webhookUrl, payload);
    } catch (err) {
        console.error('Discord 알림 실패:', err.message);
    }
}

/**
 * 트레이드 오픈 알림
 * @param {object} info
 * @param {string} info.symbol
 * @param {string} info.side 'LONG' 또는 'SHORT'
 * @param {number} info.entryPrice 진입 가격
 * @param {number} info.qty 수량
 * @param {number} info.leverage 레버리지
 * @param {number} info.tpPct 익절 퍼센트
 * @param {number} info.slPct 손절 퍼센트
 */
export async function notifyTradeOpen({ symbol, side, entryPrice, qty, leverage, tpPct, slPct }) {
    const message = `**[TRADE ENTERED]** ${symbol} ${side}\n` +
        `• Entry Price: ${entryPrice}\n` +
        `• Quantity: ${qty}\n` +
        `• Leverage: ${leverage}x\n` +
        `• TP: +${(tpPct * 100).toFixed(2)}%  SL: -${(slPct * 100).toFixed(2)}%`;
    await sendDiscord(message);
}

/**
 * 트레이드 클로즈 알림
 * @param {object} info
 * @param {string} info.symbol
 * @param {string} info.side 'LONG' 또는 'SHORT'
 * @param {number} info.exitPrice 청산 가격
 * @param {string} info.exitReason 'TAKE_PROFIT' | 'STOP_LOSS' | 'EMERGENCY' | 'MANUAL'
 * @param {number} info.pnl 실현 손익
 */
export async function notifyTradeClose({ symbol, side, exitPrice, exitReason, pnl }) {
    const sign = pnl >= 0 ? '+' : '';
    const message = `**[TRADE CLOSED]** ${symbol} ${side}\n` +
        `• Exit Price: ${exitPrice}\n` +
        `• Reason: ${exitReason}\n` +
        `• P&L: ${sign}${pnl}`;
    await sendDiscord(message);
}

/**
 * 긴급 상황 알림 (에러, 긴급 청산 등)
 * @param {object} info
 * @param {string} info.message 알림 내용
 */
export async function notifyEmergency({ message }) {
    const content = `**[EMERGENCY]**\n${message}`;
    await sendDiscord(content, true);
}

export async function sendTelegramAlert(webhookUrl, message) {
    try {
        await axios.post(webhookUrl, { text: message });
        console.log('[텔레그램] 알림 전송 성공:', message);
    } catch (e) {
        console.error('[텔레그램] 알림 전송 실패:', e.message);
    }
}