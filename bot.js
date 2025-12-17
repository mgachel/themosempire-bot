/**
 * ============================================
 * THEMOSEMPIRE FX - TELEGRAM BOT
 * Financial Literacy & Forex Trading Academy
 * Founded by Ayarisi Amos
 * 
 * Features:
 * - AUTOMATED Paystack payments
 * - Auto group access after payment
 * - Subscription management with auto-expiry
 * - Auto-removal from groups when expired
 * - Renewal reminders (3 days & 1 day before)
 * ============================================
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_00368579d28a59477f6ef54414fbe65602adbb97';
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_3c4130cf2ffa483ade57eddac4504bc706e52bac';
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID || '6330862723';
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL || ''; // Your deployed URL e.g., https://your-app.onrender.com

// Telegram Group IDs (Add bot as admin to groups, then get group IDs)
// To get group ID: Add bot to group, send a message, check bot updates
const GROUP_IDS = {
    'free-trial': process.env.GROUP_FREE_TRIAL || null,
    'vip-signals': process.env.GROUP_VIP_SIGNALS || null,
    'pro-trader-plan': process.env.GROUP_PRO_TRADER || null,
    'lifetime-access': process.env.GROUP_LIFETIME || null
};

// Telegram Group Invite Links
const TELEGRAM_LINKS = {
    'free-trial': process.env.TELEGRAM_FREE_TRIAL_LINK || 'https://t.me/+FreeTrialLink',
    'vip-signals': process.env.TELEGRAM_VIP_SIGNALS_LINK || 'https://t.me/+VIPSignalsLink',
    'pro-trader-plan': process.env.TELEGRAM_PRO_TRADER_LINK || 'https://t.me/+ProTraderLink',
    'lifetime-access': process.env.TELEGRAM_LIFETIME_ACCESS_LINK || 'https://t.me/+LifetimeLink'
};

// Pricing Plans with duration in days
const PLANS = {
    'free-trial': {
        name: 'Free Trial',
        amount: 0,
        durationDays: 7,
        duration: '7 days',
        description: 'Introduction to financial literacy basics',
        features: ['Basic forex concepts', 'Sample lessons', 'Community access'],
        isLifetime: false
    },
    'vip-signals': {
        name: 'VIP Signals',
        amount: 200,
        durationDays: 30,
        duration: 'Monthly',
        description: 'Daily & weekly trading alerts',
        features: ['Daily market alerts', 'Entry & exit points', 'Expert analysis', 'Telegram updates'],
        isLifetime: false
    },
    'pro-trader-plan': {
        name: 'Pro Trader Plan',
        amount: 500,
        durationDays: 30,
        duration: 'Monthly',
        description: 'Complete package with mentorship',
        features: ['All courses', 'Live trading sessions', '1-on-1 mentorship', 'Trading signals', 'Priority support'],
        isLifetime: false
    },
    'lifetime-access': {
        name: 'Lifetime Access',
        amount: 2000,
        durationDays: 36500,
        duration: 'Lifetime',
        description: 'Forever access to all courses',
        features: ['All courses forever', 'Lifetime updates', 'Premium resources', 'Community access', 'Priority support'],
        isLifetime: true
    }
};

// FAQs
const FAQS = [
    {
        question: "Do I need prior knowledge?",
        answer: "No! Our beginner modules are perfect for those starting from scratch."
    },
    {
        question: "Is forex trading legal and safe?",
        answer: "Yes. With proper education and risk management, forex trading is a legitimate global market."
    },
    {
        question: "Will I get mentorship?",
        answer: "Yes! Pro Trader Plan and 3-Year Analytical Stage include one-on-one mentorship with Ayarisi Amos."
    },
    {
        question: "What payment methods accepted?",
        answer: "We accept Mobile Money (MTN, Vodafone, AirtelTigo) and Bank Cards via Paystack - secure and instant!"
    },
    {
        question: "What happens when subscription expires?",
        answer: "You'll get reminders 3 days and 1 day before. After expiry, you'll be removed from the group until you renew."
    },
    {
        question: "How do I renew?",
        answer: "Use /renew command or click any payment button. Your access extends from current expiry date."
    }
];

// ============================================
// DATABASE (JSON File Storage)
// ============================================

const DATA_FILE = path.join(__dirname, 'database.json');

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
    return { users: {}, subscriptions: {}, payments: [] };
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

let db = loadData();

// ============================================
// INITIALIZE BOT
// ============================================

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();
app.use(express.json());

console.log('Themosempire Fx Bot starting...');

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function getDaysLeft(expiryDate) {
    const now = new Date();
    const expiry = new Date(expiryDate);
    return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
}

function addSubscription(userId, planId, paymentRef) {
    const plan = PLANS[planId];
    const now = new Date();
    
    // If user has existing active sub for this plan, extend from expiry date
    let startFrom = now;
    if (db.subscriptions[userId]) {
        const existing = db.subscriptions[userId].find(s => s.planId === planId && s.isActive);
        if (existing && new Date(existing.expiryDate) > now) {
            startFrom = new Date(existing.expiryDate);
        }
    }
    
    const expiryDate = new Date(startFrom.getTime() + (plan.durationDays * 24 * 60 * 60 * 1000));
    
    const subscription = {
        userId,
        planId,
        planName: plan.name,
        startDate: now.toISOString(),
        expiryDate: expiryDate.toISOString(),
        isLifetime: plan.isLifetime,
        isActive: true,
        paymentRef,
        reminder3Days: false,
        reminder1Day: false,
        createdAt: now.toISOString()
    };
    
    if (!db.subscriptions[userId]) {
        db.subscriptions[userId] = [];
    }
    
    // Deactivate old subscription for same plan
    db.subscriptions[userId].forEach(s => {
        if (s.planId === planId) s.isActive = false;
    });
    
    db.subscriptions[userId].push(subscription);
    saveData();
    
    return subscription;
}

function getActiveSubscriptions(userId) {
    if (!db.subscriptions[userId]) return [];
    const now = new Date();
    return db.subscriptions[userId].filter(s => 
        s.isActive && (s.isLifetime || new Date(s.expiryDate) > now)
    );
}

function hasActivePlan(userId, planId) {
    const subs = getActiveSubscriptions(userId);
    return subs.some(s => s.planId === planId);
}

// ============================================
// SUBSCRIPTION MONITORING - Auto-expiry Check
// ============================================

async function checkAllSubscriptions() {
    console.log('Checking subscriptions for expiry...');
    const now = new Date();
    
    for (const userId in db.subscriptions) {
        for (const sub of db.subscriptions[userId]) {
            if (!sub.isActive || sub.isLifetime) continue;
            
            const daysLeft = getDaysLeft(sub.expiryDate);
            
            // 3-day reminder
            if (daysLeft <= 3 && daysLeft > 1 && !sub.reminder3Days) {
                await sendExpiryReminder(userId, sub, daysLeft);
                sub.reminder3Days = true;
                saveData();
            }
            
            // 1-day reminder
            if (daysLeft <= 1 && daysLeft > 0 && !sub.reminder1Day) {
                await sendExpiryReminder(userId, sub, daysLeft);
                sub.reminder1Day = true;
                saveData();
            }
            
            // Expired - remove from group
            if (daysLeft <= 0) {
                await handleExpiredSubscription(userId, sub);
            }
        }
    }
}

async function sendExpiryReminder(userId, sub, daysLeft) {
    const plan = PLANS[sub.planId];
    const dayText = daysLeft === 1 ? '1 day' : `${daysLeft} days`;
    
    const message = `
⚠️ *Subscription Expiring Soon!*

Your *${sub.planName}* expires in *${dayText}*!

📅 Expiry: ${formatDate(sub.expiryDate)}
💰 Renew for: ₵${plan.amount}

Renew now to keep your access! 👇
    `;
    
    const keyboard = {
        inline_keyboard: [
            [{ text: `Renew ${sub.planName} - ₵${plan.amount}`, callback_data: `pay_${sub.planId}` }],
            [{ text: '📋 All Plans', callback_data: 'view_pricing' }]
        ]
    };
    
    try {
        await bot.sendMessage(userId, message, { parse_mode: 'Markdown', reply_markup: keyboard });
        console.log(`📧 Sent ${daysLeft}-day reminder to ${userId}`);
    } catch (err) {
        console.error(`Failed to send reminder to ${userId}:`, err.message);
    }
}

async function handleExpiredSubscription(userId, sub) {
    sub.isActive = false;
    saveData();
    
    // Remove from group if group ID is set
    const groupId = GROUP_IDS[sub.planId];
    if (groupId) {
        try {
            await bot.banChatMember(groupId, userId);
            await bot.unbanChatMember(groupId, userId); // Unban so they can rejoin after renewal
            console.log(`🚫 Removed ${userId} from ${sub.planName} group`);
        } catch (err) {
            console.error(`Failed to remove ${userId} from group:`, err.message);
        }
    }
    
    // Notify user
    const plan = PLANS[sub.planId];
    const message = `
❌ *Subscription Expired*

Your *${sub.planName}* has expired and you've been removed from the group.

To regain access, renew your subscription:
💰 *₵${plan.amount}* for ${plan.duration}

Click below to renew! 👇
    `;
    
    const keyboard = {
        inline_keyboard: [
            [{ text: `🔄 Renew Now - ₵${plan.amount}`, callback_data: `pay_${sub.planId}` }],
            [{ text: '📞 Contact Support', callback_data: 'contact' }]
        ]
    };
    
    try {
        await bot.sendMessage(userId, message, { parse_mode: 'Markdown', reply_markup: keyboard });
    } catch (err) {
        console.error(`Failed to notify ${userId} about expiry:`, err.message);
    }
    
    // Notify admin
    if (ADMIN_TELEGRAM_ID) {
        await bot.sendMessage(ADMIN_TELEGRAM_ID, 
            `🔔 *Subscription Expired*\nUser: \`${userId}\`\nPlan: ${sub.planName}`, 
            { parse_mode: 'Markdown' }
        ).catch(() => {});
    }
}

// Run check every hour
setInterval(checkAllSubscriptions, 60 * 60 * 1000);
// Run on startup after 5 seconds
setTimeout(checkAllSubscriptions, 5000);

// ============================================
// BOT COMMANDS
// ============================================

// /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'there';
    
    // Save user
    db.users[chatId] = {
        oduserId: chatId,
        firstName: msg.from.first_name,
        lastName: msg.from.last_name,
        username: msg.from.username,
        joinedAt: new Date().toISOString()
    };
    saveData();
    
    const message = `
🎯 *Welcome to Themosempire Fx, ${name}!*

Master Your Money. Conquer the Forex Market.

I can help you with:
📚 Course enrollment
💳 Payments & subscriptions
📊 Trading signals
⏰ Subscription management

*Founded by Ayarisi Amos*
📍 Navrongo, Ghana
    `;
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '📚 Courses', callback_data: 'courses' }, { text: '💰 Pricing', callback_data: 'view_pricing' }],
            [{ text: '📊 Signals', callback_data: 'signals' }, { text: '📋 My Subs', callback_data: 'my_subs' }],
            [{ text: '❓ FAQs', callback_data: 'faqs' }, { text: '📞 Contact', callback_data: 'contact' }]
        ]
    };
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown', reply_markup: keyboard });
});

// /status - Check subscription status
bot.onText(/\/status/, (msg) => showMySubscriptions(msg.chat.id));

// /renew
bot.onText(/\/renew/, (msg) => showPricing(msg.chat.id));

// /help
bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id, `
📖 *Bot Commands*

/start - Main menu
/status - Check subscriptions
/renew - Renew subscription
/pricing - View plans
/faq - FAQs
/contact - Get support
/help - This message

*Your Admin ID:* \`${msg.chat.id}\`
    `, { parse_mode: 'Markdown' });
});

// /pricing
bot.onText(/\/pricing/, (msg) => showPricing(msg.chat.id));

// /faq
bot.onText(/\/faq/, (msg) => showFAQs(msg.chat.id));

// /contact
bot.onText(/\/contact/, (msg) => showContact(msg.chat.id));

// ============================================
// ADMIN COMMANDS
// ============================================

// /approve <userId> <planId> - Approve payment
bot.onText(/\/approve (\d+) (.+)/, async (msg, match) => {
    if (msg.chat.id.toString() !== ADMIN_TELEGRAM_ID.toString()) {
        return bot.sendMessage(msg.chat.id, '❌ Admin only command');
    }
    
    const userId = match[1];
    const planId = match[2].trim();
    const plan = PLANS[planId];
    
    if (!plan) {
        return bot.sendMessage(msg.chat.id, `❌ Invalid plan. Valid plans:\n${Object.keys(PLANS).join('\n')}`);
    }
    
    const sub = addSubscription(userId, planId, 'APPROVED_' + Date.now());
    
    // Notify user
    const userMsg = `
🎉 *Payment Confirmed!*

Your *${plan.name}* is now active!

📅 Expires: ${plan.isLifetime ? 'Never (Lifetime)' : formatDate(sub.expiryDate)}

Join your group now! 👇
    `;
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '🚀 Join Group', url: TELEGRAM_LINKS[planId] }],
            [{ text: '📋 My Subscriptions', callback_data: 'my_subs' }]
        ]
    };
    
    try {
        await bot.sendMessage(userId, userMsg, { parse_mode: 'Markdown', reply_markup: keyboard });
        bot.sendMessage(msg.chat.id, `✅ Approved ${plan.name} for user ${userId}`);
    } catch (err) {
        bot.sendMessage(msg.chat.id, `⚠️ Approved but couldn't notify user: ${err.message}`);
    }
});

// /subs - View all subscribers
bot.onText(/\/subs/, (msg) => {
    if (msg.chat.id.toString() !== ADMIN_TELEGRAM_ID.toString()) return;
    
    let message = `📊 *Active Subscriptions*\n\n`;
    let count = 0;
    
    for (const odId in db.subscriptions) {
        const active = getActiveSubscriptions(odId);
        if (active.length > 0) {
            const user = db.users[odId];
            message += `*${user?.firstName || odId}* (@${user?.username || 'N/A'})\n`;
            active.forEach(s => {
                const days = getDaysLeft(s.expiryDate);
                message += `  • ${s.planName}: ${s.isLifetime ? '♾️' : days + 'd left'}\n`;
            });
            count++;
        }
    }
    
    message += `\n*Total:* ${count} users`;
    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
});

// /broadcast <message> - Send to all users
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    if (msg.chat.id.toString() !== ADMIN_TELEGRAM_ID.toString()) return;
    
    const text = match[1];
    let sent = 0, failed = 0;
    
    for (const odId in db.users) {
        try {
            await bot.sendMessage(odId, `📢 *Announcement*\n\n${text}`, { parse_mode: 'Markdown' });
            sent++;
        } catch {
            failed++;
        }
    }
    
    bot.sendMessage(msg.chat.id, `✅ Broadcast sent: ${sent} success, ${failed} failed`);
});

// ============================================
// CALLBACK HANDLERS
// ============================================

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    bot.answerCallbackQuery(query.id);
    
    if (data === 'courses') showCourses(chatId);
    else if (data === 'view_pricing') showPricing(chatId);
    else if (data === 'signals') showSignals(chatId);
    else if (data === 'my_subs') showMySubscriptions(chatId);
    else if (data === 'faqs') showFAQs(chatId);
    else if (data === 'contact') showContact(chatId);
    else if (data === 'main_menu') showMainMenu(chatId);
    else if (data.startsWith('faq_')) showFAQAnswer(chatId, parseInt(data.replace('faq_', '')));
    else if (data.startsWith('pay_')) initPayment(chatId, data.replace('pay_', ''), query.from);
    else if (data.startsWith('paystack_')) generatePaystackLink(chatId, data.replace('paystack_', ''), query.from);
    else if (data.startsWith('verify_')) verifyPaystackPayment(chatId, data.replace('verify_', ''));
});

// Handle email input for Paystack payment
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    
    // Check if this is a reply to email request
    if (msg.reply_to_message && db.pendingPayments?.[chatId]) {
        const email = msg.text?.trim();
        
        // Basic email validation
        if (email && email.includes('@') && email.includes('.')) {
            // Save email
            db.users[chatId] = db.users[chatId] || {};
            db.users[chatId].email = email;
            saveData();
            
            // Process payment
            const pending = db.pendingPayments[chatId];
            delete db.pendingPayments[chatId];
            saveData();
            
            await createPaystackPayment(chatId, pending.planId, email, pending.user);
        } else {
            bot.sendMessage(chatId, '❌ Invalid email. Please enter a valid email address:');
        }
    }
});

// ============================================
// DISPLAY FUNCTIONS
// ============================================

function showMainMenu(chatId) {
    const keyboard = {
        inline_keyboard: [
            [{ text: '📚 Courses', callback_data: 'courses' }, { text: '💰 Pricing', callback_data: 'view_pricing' }],
            [{ text: '📊 Signals', callback_data: 'signals' }, { text: '📋 My Subs', callback_data: 'my_subs' }],
            [{ text: '❓ FAQs', callback_data: 'faqs' }, { text: '📞 Contact', callback_data: 'contact' }]
        ]
    };
    bot.sendMessage(chatId, '🏠 *Main Menu*', { parse_mode: 'Markdown', reply_markup: keyboard });
}

function showCourses(chatId) {
    const message = `
📚 *Our Courses*

1️⃣ *Financial Literacy 101* - Beginner
   Budgeting, saving, wealth planning

2️⃣ *Introduction to Forex* - Beginner
   Market basics, currency pairs, brokers

3️⃣ *Technical Analysis* - Intermediate
   Chart reading, indicators, patterns

4️⃣ *Trading Psychology* - Advanced
   Emotions, risk management, discipline

5️⃣ *Live Mentorship* - Premium
   Trade with Ayarisi Amos directly

✅ All include: Videos, PDFs, Assignments, Certificate
    `;
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '💰 View Pricing', callback_data: 'view_pricing' }],
            [{ text: '🏠 Menu', callback_data: 'main_menu' }]
        ]
    };
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown', reply_markup: keyboard });
}

function showPricing(chatId) {
    const message = `
💰 *Choose Your Plan*

🆓 *Free Trial* - FREE (7 days)
📊 *VIP Signals* - ₵200/month
⭐ *Pro Trader* - ₵500/month
♾️ *Lifetime* - ₵2,000 (one-time)

Select a plan below:
    `;
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '🆓 Free Trial', callback_data: 'pay_free-trial' }],
            [{ text: '📊 VIP Signals ₵200', callback_data: 'pay_vip-signals' }, { text: '⭐ Pro ₵500', callback_data: 'pay_pro-trader-plan' }],
            [{ text: '♾️ Lifetime ₵2,000', callback_data: 'pay_lifetime-access' }],
            [{ text: '🏠 Menu', callback_data: 'main_menu' }]
        ]
    };
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown', reply_markup: keyboard });
}

function showSignals(chatId) {
    const message = `
📊 *VIP Trading Signals*

Get daily & weekly forex signals from Ayarisi Amos!

✅ Entry & exit points
✅ Stop loss & take profit
✅ Market analysis
✅ Telegram alerts

*Price:* ₵200/month
    `;
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '📊 Subscribe ₵200/mo', callback_data: 'pay_vip-signals' }],
            [{ text: '🏠 Menu', callback_data: 'main_menu' }]
        ]
    };
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown', reply_markup: keyboard });
}

function showMySubscriptions(chatId) {
    const subs = getActiveSubscriptions(chatId);
    
    if (subs.length === 0) {
        const message = `📋 *Your Subscriptions*\n\nNo active subscriptions.\n\nStart with a free trial or choose a plan!`;
        const keyboard = {
            inline_keyboard: [
                [{ text: '🆓 Free Trial', callback_data: 'pay_free-trial' }],
                [{ text: '💰 View Plans', callback_data: 'view_pricing' }],
                [{ text: '🏠 Menu', callback_data: 'main_menu' }]
            ]
        };
        return bot.sendMessage(chatId, message, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
    
    let message = `📋 *Your Active Subscriptions*\n\n`;
    const renewButtons = [];
    
    subs.forEach(sub => {
        const days = getDaysLeft(sub.expiryDate);
        const status = sub.isLifetime ? '♾️ Lifetime' : 
                      days > 7 ? '✅ Active' : 
                      days > 0 ? '⚠️ Expiring' : '❌ Expired';
        
        message += `*${sub.planName}*\n`;
        message += `Status: ${status}\n`;
        if (!sub.isLifetime) {
            message += `Expires: ${formatDate(sub.expiryDate)}\n`;
            message += `Days left: ${Math.max(0, days)}\n`;
            
            if (days <= 7) {
                renewButtons.push([{ text: `🔄 Renew ${sub.planName}`, callback_data: `pay_${sub.planId}` }]);
            }
        }
        message += '\n';
    });
    
    const keyboard = {
        inline_keyboard: [
            ...renewButtons,
            [{ text: '💰 All Plans', callback_data: 'view_pricing' }],
            [{ text: '🏠 Menu', callback_data: 'main_menu' }]
        ]
    };
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown', reply_markup: keyboard });
}

function showFAQs(chatId) {
    const buttons = FAQS.map((faq, i) => [{ text: `${i+1}. ${faq.question}`, callback_data: `faq_${i}` }]);
    buttons.push([{ text: '🏠 Menu', callback_data: 'main_menu' }]);
    
    bot.sendMessage(chatId, '❓ *FAQs - Select a question:*', { 
        parse_mode: 'Markdown', 
        reply_markup: { inline_keyboard: buttons } 
    });
}

function showFAQAnswer(chatId, index) {
    const faq = FAQS[index];
    bot.sendMessage(chatId, `❓ *${faq.question}*\n\n${faq.answer}`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'faqs' }, { text: '🏠 Menu', callback_data: 'main_menu' }]] }
    });
}

function showContact(chatId) {
    const message = `
📞 *Contact Support*

*Ayarisi Amos* - Founder

📧 Themosempire@gmail.com
📱 +233 596 688 947
📍 Navrongo, Ghana

💳 All payments via Paystack (MoMo/Card)
    `;
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '💬 WhatsApp', url: 'https://wa.me/233596688947' }],
            [{ text: '🏠 Menu', callback_data: 'main_menu' }]
        ]
    };
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown', reply_markup: keyboard });
}

// ============================================
// PAYMENT FUNCTIONS - PAYSTACK INTEGRATION
// ============================================

async function initPayment(chatId, planId, user) {
    const plan = PLANS[planId];
    if (!plan) return bot.sendMessage(chatId, '❌ Invalid plan');
    
    // Free trial
    if (plan.amount === 0) {
        // Check if already used
        if (db.subscriptions[chatId]?.some(s => s.planId === 'free-trial')) {
            return bot.sendMessage(chatId, '❌ You already used your free trial!\n\nChoose a paid plan to continue.', {
                reply_markup: { inline_keyboard: [[{ text: '💰 View Plans', callback_data: 'view_pricing' }]] }
            });
        }
        
        const sub = addSubscription(chatId, planId, 'FREE_' + Date.now());
        
        const message = `
🎉 *Free Trial Activated!*

Your 7-day trial is now active!
Expires: ${formatDate(sub.expiryDate)}

Join the group below! 👇
        `;
        
        bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [
                [{ text: '🚀 Join Group', url: TELEGRAM_LINKS[planId] }],
                [{ text: '💰 Upgrade', callback_data: 'view_pricing' }]
            ]}
        });
        
        // Notify admin
        if (ADMIN_TELEGRAM_ID) {
            bot.sendMessage(ADMIN_TELEGRAM_ID, `🆓 Free trial: ${user.first_name} (@${user.username || 'N/A'}) - ID: \`${chatId}\``, { parse_mode: 'Markdown' });
        }
        return;
    }
    
    // Check if already has lifetime
    if (planId === 'lifetime-access' && hasActivePlan(chatId, planId)) {
        return bot.sendMessage(chatId, '✅ You already have Lifetime Access!');
    }
    
    // Show payment options - Paystack only
    const message = `
💳 *Pay for ${plan.name}*

*Amount:* ₵${plan.amount.toLocaleString()}
*Duration:* ${plan.duration}

💡 Pay securely with Paystack (Mobile Money or Card)
    `;
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '💳 Pay Now (Card/MoMo)', callback_data: `paystack_${planId}` }],
            [{ text: '⬅️ Back', callback_data: 'view_pricing' }]
        ]
    };
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown', reply_markup: keyboard });
}

// Generate Paystack payment link
async function generatePaystackLink(chatId, planId, user) {
    const plan = PLANS[planId];
    
    // Check if user has email stored, if not ask for it
    const userData = db.users[chatId];
    
    if (!userData?.email) {
        // Store pending payment
        db.pendingPayments = db.pendingPayments || {};
        db.pendingPayments[chatId] = { planId, user };
        saveData();
        
        bot.sendMessage(chatId, `📧 Please enter your email address to proceed with payment:`, {
            reply_markup: { force_reply: true }
        });
        return;
    }
    
    await createPaystackPayment(chatId, planId, userData.email, user);
}

// Create Paystack payment
async function createPaystackPayment(chatId, planId, email, user) {
    const plan = PLANS[planId];
    const reference = `TFX_${chatId}_${planId}_${Date.now()}`;
    
    try {
        // Initialize Paystack transaction
        const response = await axios.post('https://api.paystack.co/transaction/initialize', {
            email: email,
            amount: plan.amount * 100, // Convert to pesewas
            reference: reference,
            currency: 'GHS',
            callback_url: WEBHOOK_URL ? `${WEBHOOK_URL}/payment/callback` : undefined,
            metadata: {
                telegram_user_id: chatId.toString(),
                plan_id: planId,
                plan_name: plan.name,
                user_first_name: user.first_name,
                username: user.username || ''
            }
        }, {
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.data.status) {
            const paymentUrl = response.data.data.authorization_url;
            
            // Store pending payment reference
            db.pendingPaystackPayments = db.pendingPaystackPayments || {};
            db.pendingPaystackPayments[reference] = {
                chatId,
                planId,
                email,
                user,
                createdAt: new Date().toISOString()
            };
            saveData();
            
            const message = `
💳 *Pay for ${plan.name}*

*Amount:* ₵${plan.amount.toLocaleString()}
*Email:* ${email}

Click the button below to pay securely with Paystack (Card or Mobile Money):
            `;
            
            bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💳 Pay Now - ₵' + plan.amount.toLocaleString(), url: paymentUrl }],
                        [{ text: '✅ I Have Paid', callback_data: `verify_${reference}` }],
                        [{ text: '⬅️ Back', callback_data: 'view_pricing' }]
                    ]
                }
            });
        } else {
            throw new Error('Failed to initialize payment');
        }
    } catch (error) {
        console.error('Paystack error:', error.response?.data || error.message);
        bot.sendMessage(chatId, `❌ Error creating payment link. Please try manual payment or contact support.`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📱 Manual Payment', callback_data: `manual_${planId}` }],
                    [{ text: '📞 Contact Support', callback_data: 'contact' }]
                ]
            }
        });
    }
}

// Verify Paystack payment
async function verifyPaystackPayment(chatId, reference) {
    try {
        const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
            }
        });
        
        const data = response.data.data;
        
        if (data.status === 'success') {
            // Payment successful!
            const pendingPayment = db.pendingPaystackPayments?.[reference];
            
            if (pendingPayment) {
                await processSuccessfulPayment(
                    pendingPayment.chatId,
                    pendingPayment.planId,
                    reference,
                    pendingPayment.user
                );
                
                // Clean up
                delete db.pendingPaystackPayments[reference];
                saveData();
            }
            return true;
        } else if (data.status === 'pending') {
            bot.sendMessage(chatId, `⏳ Payment is still pending. Please complete the payment or wait a moment and try again.`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Check Again', callback_data: `verify_${reference}` }]
                    ]
                }
            });
            return false;
        } else {
            bot.sendMessage(chatId, `❌ Payment not found or failed. Please try again or contact support.`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: 'view_pricing' }],
                        [{ text: '📞 Contact Support', callback_data: 'contact' }]
                    ]
                }
            });
            return false;
        }
    } catch (error) {
        console.error('Verify error:', error.response?.data || error.message);
        bot.sendMessage(chatId, `❌ Error verifying payment. Please contact support with reference: \`${reference}\``, {
            parse_mode: 'Markdown'
        });
        return false;
    }
}

// Process successful payment - give access
async function processSuccessfulPayment(chatId, planId, reference, user) {
    const plan = PLANS[planId];
    const sub = addSubscription(chatId, planId, reference);
    
    // Record payment
    db.payments = db.payments || [];
    db.payments.push({
        chatId,
        planId,
        planName: plan.name,
        amount: plan.amount,
        reference,
        timestamp: new Date().toISOString()
    });
    saveData();
    
    // Send success message with group link
    const message = `
🎉 *Payment Successful!*

✅ *${plan.name}* is now active!

💰 Amount Paid: ₵${plan.amount.toLocaleString()}
📅 Expires: ${plan.isLifetime ? 'Never (Lifetime)' : formatDate(sub.expiryDate)}
🧾 Reference: \`${reference}\`

Join your exclusive group now! 👇
    `;
    
    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🚀 JOIN YOUR GROUP NOW', url: TELEGRAM_LINKS[planId] }],
                [{ text: '📋 My Subscriptions', callback_data: 'my_subs' }],
                [{ text: '🏠 Menu', callback_data: 'main_menu' }]
            ]
        }
    });
    
    // Notify admin
    if (ADMIN_TELEGRAM_ID) {
        bot.sendMessage(ADMIN_TELEGRAM_ID, `
💰 *NEW PAYMENT!*

User: ${user?.first_name || 'Unknown'} (@${user?.username || 'N/A'})
ID: \`${chatId}\`
Plan: ${plan.name}
Amount: ₵${plan.amount.toLocaleString()}
Ref: \`${reference}\`
        `, { parse_mode: 'Markdown' });
    }
}

// ============================================
// EXPRESS SERVER & PAYSTACK WEBHOOK
// ============================================

app.get('/', (req, res) => res.send('Themosempire Fx Bot Running! 🚀'));
app.get('/health', (req, res) => res.json({ status: 'OK', time: new Date().toISOString() }));

// Paystack Webhook - Auto process payments
app.post('/webhook/paystack', async (req, res) => {
    try {
        // Verify webhook signature
        const hash = crypto
            .createHmac('sha512', PAYSTACK_SECRET_KEY)
            .update(JSON.stringify(req.body))
            .digest('hex');
        
        if (hash !== req.headers['x-paystack-signature']) {
            console.log('Invalid Paystack webhook signature');
            return res.sendStatus(400);
        }
        
        const event = req.body;
        console.log('Paystack webhook:', event.event);
        
        if (event.event === 'charge.success') {
            const data = event.data;
            const reference = data.reference;
            const metadata = data.metadata;
            
            // Check if we have this pending payment
            const pendingPayment = db.pendingPaystackPayments?.[reference];
            
            if (pendingPayment) {
                console.log(`Processing payment: ${reference}`);
                
                await processSuccessfulPayment(
                    parseInt(pendingPayment.chatId),
                    pendingPayment.planId,
                    reference,
                    pendingPayment.user
                );
                
                // Clean up
                delete db.pendingPaystackPayments[reference];
                saveData();
            } else if (metadata?.telegram_user_id) {
                // Fallback: use metadata from Paystack
                console.log(`Processing payment from metadata: ${reference}`);
                
                await processSuccessfulPayment(
                    parseInt(metadata.telegram_user_id),
                    metadata.plan_id,
                    reference,
                    { first_name: metadata.user_first_name, username: metadata.username }
                );
            }
        }
        
        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook error:', error);
        res.sendStatus(500);
    }
});

// Payment callback page (when user returns from Paystack)
app.get('/payment/callback', async (req, res) => {
    const reference = req.query.reference;
    
    if (reference) {
        try {
            // Verify payment
            const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
                headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}` }
            });
            
            const data = response.data.data;
            
            if (data.status === 'success') {
                const metadata = data.metadata;
                const pendingPayment = db.pendingPaystackPayments?.[reference];
                
                if (pendingPayment && !db.payments?.find(p => p.reference === reference)) {
                    await processSuccessfulPayment(
                        parseInt(pendingPayment.chatId),
                        pendingPayment.planId,
                        reference,
                        pendingPayment.user
                    );
                    
                    delete db.pendingPaystackPayments[reference];
                    saveData();
                }
                
                res.send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Payment Successful - Themosempire Fx</title>
                        <meta name="viewport" content="width=device-width, initial-scale=1">
                        <style>
                            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f0f0; }
                            .card { background: white; border-radius: 15px; padding: 40px; max-width: 400px; margin: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                            .success { color: #28a745; font-size: 60px; }
                            h1 { color: #333; }
                            p { color: #666; }
                            .btn { background: #007bff; color: white; padding: 15px 30px; border-radius: 30px; text-decoration: none; display: inline-block; margin-top: 20px; }
                        </style>
                    </head>
                    <body>
                        <div class="card">
                            <div class="success">✅</div>
                            <h1>Payment Successful!</h1>
                            <p>Your subscription has been activated.</p>
                            <p>Return to Telegram to get your group access link!</p>
                            <a href="https://t.me/" class="btn">Open Telegram</a>
                        </div>
                    </body>
                    </html>
                `);
            } else {
                res.send(`
                    <!DOCTYPE html>
                    <html>
                    <head><title>Payment Pending</title></head>
                    <body style="font-family: Arial; text-align: center; padding: 50px;">
                        <h1>⏳ Payment Pending</h1>
                        <p>Your payment is being processed. Please check Telegram for confirmation.</p>
                    </body>
                    </html>
                `);
            }
        } catch (error) {
            console.error('Callback error:', error);
            res.send('<h1>Error processing payment</h1><p>Please contact support.</p>');
        }
    } else {
        res.send('<h1>Invalid request</h1>');
    }
});

app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
    console.log('✅ Bot ready!');
    console.log(`👑 Admin ID: ${ADMIN_TELEGRAM_ID}`);
    if (WEBHOOK_URL) {
        console.log(`🔗 Webhook URL: ${WEBHOOK_URL}/webhook/paystack`);
    } else {
        console.log('⚠️ Set WEBHOOK_URL in .env for automatic payment processing');
    }
});
