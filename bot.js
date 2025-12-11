/**
 * ============================================
 * THEMOSEMPIRE FX - TELEGRAM BOT
 * Financial Literacy & Forex Trading Academy
 * Founded by Ayarisi Amos
 * ============================================
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// ============================================
// CONFIGURATION
// ============================================

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;
const PORT = process.env.PORT || 3000;

// Telegram Group Links
const TELEGRAM_LINKS = {
    'free-trial': process.env.TELEGRAM_FREE_TRIAL_LINK || 'https://t.me/+FreeTrialLink',
    'basic-plan': process.env.TELEGRAM_BASIC_PLAN_LINK || 'https://t.me/+BasicPlanLink',
    'pro-trader-plan': process.env.TELEGRAM_PRO_TRADER_LINK || 'https://t.me/+ProTraderLink',
    'lifetime-access': process.env.TELEGRAM_LIFETIME_ACCESS_LINK || 'https://t.me/+LifetimeLink',
    'trading-signals': process.env.TELEGRAM_TRADING_SIGNALS_LINK || 'https://t.me/+SignalsLink',
    '3-year-analytical-stage': process.env.TELEGRAM_PREMIUM_3YEAR_LINK || 'https://t.me/+PremiumLink'
};

// Pricing Plans (amounts in GHS)
const PLANS = {
    'free-trial': {
        name: 'Free Trial',
        amount: 0,
        duration: '7 days',
        description: 'Introduction to financial literacy basics',
        features: ['Basic forex concepts', 'Sample lessons', 'Community access']
    },
    'basic-plan': {
        name: 'Basic Plan',
        amount: 300,
        duration: 'Monthly',
        description: 'Core courses access for beginners',
        features: ['All core courses', 'Video lessons', 'Downloadable PDFs', 'Assignments']
    },
    'pro-trader-plan': {
        name: 'Pro Trader Plan',
        amount: 500,
        duration: 'Monthly',
        description: 'Complete package with mentorship',
        features: ['All courses', 'Live trading sessions', '1-on-1 mentorship', 'Trading signals', 'Priority support']
    },
    'lifetime-access': {
        name: 'Lifetime Access',
        amount: 1500,
        duration: 'One-time',
        description: 'Forever access to all courses',
        features: ['All courses forever', 'Lifetime updates', 'Premium resources', 'Community access']
    },
    'trading-signals': {
        name: 'Trading Signals',
        amount: 200,
        duration: 'Monthly',
        description: 'Daily & weekly trading alerts',
        features: ['Daily market alerts', 'Entry & exit points', 'Expert analysis', 'Telegram updates']
    },
    '3-year-analytical-stage': {
        name: '3-Year Analytical Stage',
        amount: 30000,
        duration: 'One-time',
        description: 'Premium complete mastery program',
        features: ['3 years mentorship', 'Advanced analytics', 'All resources', 'Expert certification', 'Lifetime support']
    }
};

// FAQs
const FAQS = [
    {
        question: "Do I need prior knowledge to start?",
        answer: "No! Our beginner modules are perfect for those starting from scratch. We start with the fundamentals and progress at a comfortable pace."
    },
    {
        question: "Is forex trading legal and safe?",
        answer: "Yes. With proper education and risk management, forex trading is a legitimate global market. We emphasize risk management strategies to protect your capital."
    },
    {
        question: "Will I get mentorship?",
        answer: "Yes! Our Pro Trader Plan and 3-Year Analytical Stage include one-on-one mentorship sessions with Ayarisi Amos."
    },
    {
        question: "What payment methods do you accept?",
        answer: "We accept:\n• Mobile Money (MTN, Vodafone, AirtelTigo)\n• Bank cards (Visa, Mastercard)\n• Bank transfer\n• Cryptocurrency (DM for details)"
    },
    {
        question: "How long to see results?",
        answer: "Results vary based on dedication. Many students report profitable trades within 2-3 months after completing core courses."
    },
    {
        question: "Do I get a certificate?",
        answer: "Yes! All our courses come with a Certificate of Completion upon finishing the program."
    },
    {
        question: "Can I pay in installments?",
        answer: "Yes, we offer flexible payment plans. Contact us via WhatsApp (+233 596 688 947) to discuss installment options."
    },
    {
        question: "How do I access course materials?",
        answer: "After payment, you'll receive a Telegram group invite link where all course materials, videos, and resources are shared."
    }
];

// User data storage (in production, use a database)
const users = new Map();
const pendingPayments = new Map();
const subscriptions = new Map();

// ============================================
// INITIALIZE BOT
// ============================================

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();
app.use(express.json());

console.log('🤖 Themosempire Fx Bot is starting...');

// ============================================
// BOT COMMANDS
// ============================================

// /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'there';
    
    // Store user
    users.set(chatId, {
        id: chatId,
        firstName: msg.from.first_name,
        lastName: msg.from.last_name,
        username: msg.from.username,
        joinedAt: new Date().toISOString()
    });

    const welcomeMessage = `
🎯 *Welcome to Themosempire Fx Academy, ${firstName}!*

Master Your Money. Conquer the Forex Market.

I'm your assistant bot for:
• 📚 Course enrollment & payments
• 📊 Trading signals subscription
• ❓ FAQs and support
• 💳 Payment management

*Founded by Ayarisi Amos* - 7+ years trading experience, Exness Broker Partner.

📍 Location: Navrongo, Ghana

What would you like to do?
    `;

    const keyboard = {
        inline_keyboard: [
            [{ text: '📚 View Courses', callback_data: 'view_courses' }],
            [{ text: '💰 Pricing & Plans', callback_data: 'view_pricing' }],
            [{ text: '📊 Trading Signals', callback_data: 'trading_signals' }],
            [{ text: '❓ FAQs', callback_data: 'view_faqs' }],
            [{ text: '👤 About Us', callback_data: 'about_us' }],
            [{ text: '📞 Contact Support', callback_data: 'contact_support' }]
        ]
    };

    bot.sendMessage(chatId, welcomeMessage, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
    });
});

// /help command
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    
    const helpMessage = `
📖 *Themosempire Fx Bot Commands*

/start - Start the bot & main menu
/courses - View available courses
/pricing - View pricing plans
/signals - Trading signals info
/faq - Frequently asked questions
/pay - Make a payment
/status - Check subscription status
/contact - Contact support
/about - About Themosempire Fx
/help - Show this help message

Need assistance? Contact us:
📧 Themosempire@gmail.com
📱 +233 596 688 947
    `;

    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// /courses command
bot.onText(/\/courses/, (msg) => {
    showCourses(msg.chat.id);
});

// /pricing command
bot.onText(/\/pricing/, (msg) => {
    showPricing(msg.chat.id);
});

// /signals command
bot.onText(/\/signals/, (msg) => {
    showTradingSignals(msg.chat.id);
});

// /faq command
bot.onText(/\/faq/, (msg) => {
    showFAQs(msg.chat.id);
});

// /about command
bot.onText(/\/about/, (msg) => {
    showAbout(msg.chat.id);
});

// /contact command
bot.onText(/\/contact/, (msg) => {
    showContact(msg.chat.id);
});

// /status command
bot.onText(/\/status/, (msg) => {
    showSubscriptionStatus(msg.chat.id);
});

// /pay command
bot.onText(/\/pay/, (msg) => {
    showPricing(msg.chat.id);
});

// ============================================
// CALLBACK QUERY HANDLERS
// ============================================

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    // Acknowledge the callback
    bot.answerCallbackQuery(query.id);

    // Handle different callbacks
    if (data === 'view_courses') {
        showCourses(chatId);
    } else if (data === 'view_pricing') {
        showPricing(chatId);
    } else if (data === 'trading_signals') {
        showTradingSignals(chatId);
    } else if (data === 'view_faqs') {
        showFAQs(chatId);
    } else if (data === 'about_us') {
        showAbout(chatId);
    } else if (data === 'contact_support') {
        showContact(chatId);
    } else if (data === 'main_menu') {
        showMainMenu(chatId);
    } else if (data.startsWith('faq_')) {
        const faqIndex = parseInt(data.replace('faq_', ''));
        showFAQAnswer(chatId, faqIndex);
    } else if (data.startsWith('pay_')) {
        const planId = data.replace('pay_', '');
        initiatePayment(chatId, planId, query.from);
    } else if (data.startsWith('confirm_pay_')) {
        const planId = data.replace('confirm_pay_', '');
        processPayment(chatId, planId, query.from);
    } else if (data === 'free_trial_signup') {
        handleFreeTrialSignup(chatId, query.from);
    } else if (data === 'back_to_pricing') {
        showPricing(chatId);
    } else if (data === 'back_to_faqs') {
        showFAQs(chatId);
    }
});

// ============================================
// DISPLAY FUNCTIONS
// ============================================

function showMainMenu(chatId) {
    const message = `
🏠 *Main Menu*

What would you like to do?
    `;

    const keyboard = {
        inline_keyboard: [
            [{ text: '📚 View Courses', callback_data: 'view_courses' }],
            [{ text: '💰 Pricing & Plans', callback_data: 'view_pricing' }],
            [{ text: '📊 Trading Signals', callback_data: 'trading_signals' }],
            [{ text: '❓ FAQs', callback_data: 'view_faqs' }],
            [{ text: '👤 About Us', callback_data: 'about_us' }],
            [{ text: '📞 Contact Support', callback_data: 'contact_support' }]
        ]
    };

    bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
    });
}

function showCourses(chatId) {
    const coursesMessage = `
📚 *Our Programs*

*1️⃣ Financial Literacy 101* (Beginner)
Budgeting, saving, debt management, and wealth planning.

*2️⃣ Introduction to Forex* (Beginner-Intermediate)
Forex market basics, currency pairs, brokers, and how trading works.

*3️⃣ Technical & Fundamental Analysis* (Intermediate)
Chart reading, indicators, market news, and economic calendars.

*4️⃣ Trading Psychology & Risk Management* (Intermediate-Advanced)
Controlling emotions, managing losses, and smart decision-making.

*5️⃣ Live Trading & Mentorship Program* (Advanced)
Trade with experts, receive feedback, and grow your strategy.

*6️⃣ 3-Year Analytical Stage* (Expert)
Complete mastery program with intensive training - $2,900 (GHS 30,000)

━━━━━━━━━━━━━━━━━━━━━

✅ Each course includes:
• Video lessons
• Downloadable PDFs
• Practical assignments
• Certificate of Completion
    `;

    const keyboard = {
        inline_keyboard: [
            [{ text: '💰 View Pricing', callback_data: 'view_pricing' }],
            [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
        ]
    };

    bot.sendMessage(chatId, coursesMessage, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
    });
}

function showPricing(chatId) {
    const pricingMessage = `
💰 *Choose Your Plan*

━━━━━━━━━━━━━━━━━━━━━

🆓 *Free Trial* - FREE
• 7 days access
• Intro to financial literacy
• Sample lessons

━━━━━━━━━━━━━━━━━━━━━

📘 *Basic Plan* - GHS 300/month
• All core courses
• Video lessons
• Downloadable PDFs

━━━━━━━━━━━━━━━━━━━━━

⭐ *Pro Trader Plan* - GHS 500/month
• All courses + mentorship
• Live trading sessions
• Trading signals
• Priority support

━━━━━━━━━━━━━━━━━━━━━

♾️ *Lifetime Access* - GHS 1,500 (one-time)
• All courses forever
• Lifetime updates
• Premium resources

━━━━━━━━━━━━━━━━━━━━━

📊 *Trading Signals* - GHS 200/month
• Daily market alerts
• Entry & exit points
• Expert analysis

━━━━━━━━━━━━━━━━━━━━━

👑 *3-Year Analytical Stage* - GHS 30,000
• Complete mastery program
• 3 years mentorship
• Expert certification

━━━━━━━━━━━━━━━━━━━━━

Select a plan to enroll:
    `;

    const keyboard = {
        inline_keyboard: [
            [{ text: '🆓 Free Trial (FREE)', callback_data: 'pay_free-trial' }],
            [{ text: '📘 Basic Plan (GHS 300)', callback_data: 'pay_basic-plan' }],
            [{ text: '⭐ Pro Trader (GHS 500)', callback_data: 'pay_pro-trader-plan' }],
            [{ text: '♾️ Lifetime (GHS 1,500)', callback_data: 'pay_lifetime-access' }],
            [{ text: '📊 Signals (GHS 200)', callback_data: 'pay_trading-signals' }],
            [{ text: '👑 3-Year Premium (GHS 30,000)', callback_data: 'pay_3-year-analytical-stage' }],
            [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
        ]
    };

    bot.sendMessage(chatId, pricingMessage, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
    });
}

function showTradingSignals(chatId) {
    const signalsMessage = `
📊 *Forex Trading Signals*

Subscribe to receive daily and weekly forex trading signals from *Ayarisi Amos*.

Get accurate, market-tested alerts designed to boost your trading success!

━━━━━━━━━━━━━━━━━━━━━

*What You Get:*

📈 *Daily Market Alerts*
Receive trading opportunities every trading day

🎯 *Entry & Exit Points*
Clear signals with specific price levels

💡 *Expert Analysis*
Learn the reasoning behind each signal

⏰ *Timely Updates*
Get notified instantly via Telegram

━━━━━━━━━━━━━━━━━━━━━

💰 *Price:* GHS 200/month

Ready to boost your trades?
    `;

    const keyboard = {
        inline_keyboard: [
            [{ text: '📊 Subscribe Now (GHS 200)', callback_data: 'pay_trading-signals' }],
            [{ text: '💰 View All Plans', callback_data: 'view_pricing' }],
            [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
        ]
    };

    bot.sendMessage(chatId, signalsMessage, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
    });
}

function showFAQs(chatId) {
    const faqMessage = `
❓ *Frequently Asked Questions*

Select a question to see the answer:
    `;

    const keyboard = {
        inline_keyboard: FAQS.map((faq, index) => {
            // Truncate question if too long
            const shortQuestion = faq.question.length > 40 
                ? faq.question.substring(0, 37) + '...' 
                : faq.question;
            return [{ text: `${index + 1}. ${shortQuestion}`, callback_data: `faq_${index}` }];
        }).concat([[{ text: '🏠 Main Menu', callback_data: 'main_menu' }]])
    };

    bot.sendMessage(chatId, faqMessage, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
    });
}

function showFAQAnswer(chatId, index) {
    if (index >= 0 && index < FAQS.length) {
        const faq = FAQS[index];
        const answerMessage = `
❓ *${faq.question}*

${faq.answer}
        `;

        const keyboard = {
            inline_keyboard: [
                [{ text: '◀️ Back to FAQs', callback_data: 'back_to_faqs' }],
                [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
            ]
        };

        bot.sendMessage(chatId, answerMessage, { 
            parse_mode: 'Markdown',
            reply_markup: keyboard 
        });
    }
}

function showAbout(chatId) {
    const aboutMessage = `
👤 *About Themosempire Fx*

Welcome to *Themosempire Fx*, located in Ghana, designed for mastering financial literacy and forex trading.

━━━━━━━━━━━━━━━━━━━━━

👨‍🏫 *Founded by Ayarisi Amos*

• Experienced educator
• Swing & intraday trader
• 7+ years in the trading space
• Exness Broker Community Partner (Ghana)

━━━━━━━━━━━━━━━━━━━━━

🎯 *Our Mission*
Empower individuals to make smart money decisions and trade confidently.

━━━━━━━━━━━━━━━━━━━━━

📍 *Location:* Navrongo, Ghana
📧 *Email:* Themosempire@gmail.com
📱 *Phone:* +233 596 688 947

━━━━━━━━━━━━━━━━━━━━━

🌐 *Website:* themosempirefx.com
    `;

    const keyboard = {
        inline_keyboard: [
            [{ text: '📚 View Courses', callback_data: 'view_courses' }],
            [{ text: '💰 View Pricing', callback_data: 'view_pricing' }],
            [{ text: '📞 Contact Support', callback_data: 'contact_support' }],
            [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
        ]
    };

    bot.sendMessage(chatId, aboutMessage, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
    });
}

function showContact(chatId) {
    const contactMessage = `
📞 *Contact Themosempire Fx*

We're here to help! Reach out through any of these channels:

━━━━━━━━━━━━━━━━━━━━━

📧 *Email:*
Themosempire@gmail.com

📱 *Phone/WhatsApp:*
+233 596 688 947

📍 *Location:*
Navrongo, Ghana

━━━━━━━━━━━━━━━━━━━━━

💳 *Payment Details:*

*Mobile Money:*
0596688947 (Ayarisi Amos)

*Bank Transfer:*
Account: 9040010942548
Bank: Stanbic Bank Ghana

*Crypto:* DM for wallet addresses

━━━━━━━━━━━━━━━━━━━━━

⏰ *Response Time:*
We typically respond within 2-4 hours during business hours.
    `;

    const keyboard = {
        inline_keyboard: [
            [{ text: '💬 WhatsApp Us', url: 'https://wa.me/233596688947' }],
            [{ text: '📧 Email Us', url: 'mailto:Themosempire@gmail.com' }],
            [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
        ]
    };

    bot.sendMessage(chatId, contactMessage, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
    });
}

function showSubscriptionStatus(chatId) {
    const userSub = subscriptions.get(chatId);
    
    let statusMessage;
    let keyboard;

    if (userSub && userSub.active) {
        statusMessage = `
✅ *Your Subscription Status*

*Plan:* ${userSub.planName}
*Status:* Active ✅
*Started:* ${userSub.startDate}
*Expires:* ${userSub.expiryDate || 'Never (Lifetime)'}
*Reference:* ${userSub.reference}

━━━━━━━━━━━━━━━━━━━━━

🔗 *Your Group Access:*
${userSub.groupLink}
        `;

        keyboard = {
            inline_keyboard: [
                [{ text: '🔗 Join Group', url: userSub.groupLink }],
                [{ text: '🔄 Renew/Upgrade', callback_data: 'view_pricing' }],
                [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
            ]
        };
    } else {
        statusMessage = `
❌ *No Active Subscription*

You don't have an active subscription yet.

Start your trading journey today with one of our plans!
        `;

        keyboard = {
            inline_keyboard: [
                [{ text: '💰 View Plans', callback_data: 'view_pricing' }],
                [{ text: '🆓 Start Free Trial', callback_data: 'pay_free-trial' }],
                [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
            ]
        };
    }

    bot.sendMessage(chatId, statusMessage, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
    });
}

// ============================================
// PAYMENT FUNCTIONS
// ============================================

function initiatePayment(chatId, planId, user) {
    const plan = PLANS[planId];
    
    if (!plan) {
        bot.sendMessage(chatId, '❌ Invalid plan selected. Please try again.');
        return;
    }

    // Handle free trial separately
    if (planId === 'free-trial') {
        handleFreeTrialSignup(chatId, user);
        return;
    }

    const confirmMessage = `
💳 *Confirm Your Enrollment*

━━━━━━━━━━━━━━━━━━━━━

*Plan:* ${plan.name}
*Amount:* GHS ${plan.amount.toLocaleString()}
*Duration:* ${plan.duration}

━━━━━━━━━━━━━━━━━━━━━

*What's Included:*
${plan.features.map(f => `• ${f}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━

Click "Pay Now" to proceed with payment.
You'll receive a payment link to complete your transaction.
    `;

    const keyboard = {
        inline_keyboard: [
            [{ text: `💳 Pay GHS ${plan.amount.toLocaleString()} Now`, callback_data: `confirm_pay_${planId}` }],
            [{ text: '◀️ Back to Pricing', callback_data: 'back_to_pricing' }],
            [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
        ]
    };

    bot.sendMessage(chatId, confirmMessage, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
    });
}

async function processPayment(chatId, planId, user) {
    const plan = PLANS[planId];
    
    if (!plan) {
        bot.sendMessage(chatId, '❌ Invalid plan selected. Please try again.');
        return;
    }

    // Send processing message
    bot.sendMessage(chatId, '⏳ Generating your payment link... Please wait.');

    try {
        // Generate unique reference
        const reference = `TFX_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
        
        // Store pending payment
        pendingPayments.set(reference, {
            chatId: chatId,
            planId: planId,
            planName: plan.name,
            amount: plan.amount,
            user: user,
            createdAt: new Date().toISOString()
        });

        // Initialize Paystack transaction
        const response = await axios.post(
            'https://api.paystack.co/transaction/initialize',
            {
                email: `user_${chatId}@themosempirefx.com`, // Using chatId as identifier
                amount: plan.amount * 100, // Convert to pesewas
                currency: 'GHS',
                reference: reference,
                callback_url: `${process.env.WEBHOOK_URL}/payment-callback`,
                metadata: {
                    telegram_chat_id: chatId,
                    telegram_user_id: user.id,
                    telegram_username: user.username,
                    plan_id: planId,
                    plan_name: plan.name
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data.status) {
            const paymentUrl = response.data.data.authorization_url;
            
            const paymentMessage = `
✅ *Payment Link Generated!*

━━━━━━━━━━━━━━━━━━━━━

*Plan:* ${plan.name}
*Amount:* GHS ${plan.amount.toLocaleString()}
*Reference:* \`${reference}\`

━━━━━━━━━━━━━━━━━━━━━

Click the button below to complete your payment:

⚠️ *Important:*
• Complete payment within 30 minutes
• Don't close the payment page until done
• You'll receive your group link automatically after payment

━━━━━━━━━━━━━━━━━━━━━

*Alternative Payment Methods:*
📱 Mobile Money: 0596688947 (Ayarisi Amos)
🏦 Bank: Stanbic (9040010942548)

_After manual payment, send proof to WhatsApp: +233 596 688 947_
            `;

            const keyboard = {
                inline_keyboard: [
                    [{ text: '💳 Pay Now', url: paymentUrl }],
                    [{ text: '📱 Pay via WhatsApp', url: 'https://wa.me/233596688947?text=Hi,%20I%20want%20to%20pay%20for%20' + encodeURIComponent(plan.name) }],
                    [{ text: '◀️ Back to Pricing', callback_data: 'back_to_pricing' }]
                ]
            };

            bot.sendMessage(chatId, paymentMessage, { 
                parse_mode: 'Markdown',
                reply_markup: keyboard 
            });

            // Notify admin
            if (ADMIN_TELEGRAM_ID) {
                bot.sendMessage(ADMIN_TELEGRAM_ID, `
🔔 *New Payment Initiated*

User: ${user.first_name} ${user.last_name || ''} (@${user.username || 'no username'})
Plan: ${plan.name}
Amount: GHS ${plan.amount.toLocaleString()}
Reference: ${reference}
                `, { parse_mode: 'Markdown' });
            }

        } else {
            throw new Error('Failed to initialize payment');
        }

    } catch (error) {
        console.error('Payment initialization error:', error);
        
        const errorMessage = `
❌ *Payment Link Generation Failed*

Sorry, we couldn't generate your payment link. Please try again or use an alternative payment method:

📱 *Mobile Money:* 0596688947 (Ayarisi Amos)
🏦 *Bank:* Stanbic (9040010942548)

After payment, send proof to WhatsApp: +233 596 688 947
        `;

        const keyboard = {
            inline_keyboard: [
                [{ text: '🔄 Try Again', callback_data: `pay_${planId}` }],
                [{ text: '📱 Pay via WhatsApp', url: 'https://wa.me/233596688947' }],
                [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
            ]
        };

        bot.sendMessage(chatId, errorMessage, { 
            parse_mode: 'Markdown',
            reply_markup: keyboard 
        });
    }
}

function handleFreeTrialSignup(chatId, user) {
    const reference = `FREE_${Date.now()}`;
    const groupLink = TELEGRAM_LINKS['free-trial'];

    // Store subscription
    subscriptions.set(chatId, {
        planId: 'free-trial',
        planName: 'Free Trial',
        active: true,
        startDate: new Date().toLocaleDateString(),
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(), // 7 days
        reference: reference,
        groupLink: groupLink
    });

    const successMessage = `
🎉 *Welcome to the Free Trial!*

━━━━━━━━━━━━━━━━━━━━━

Congratulations, ${user.first_name}! 

You now have *7 days* of free access to:
• Introduction to financial literacy
• Basic forex concepts
• Sample lessons
• Community access

━━━━━━━━━━━━━━━━━━━━━

🔗 *Join Your Group Now:*
Click the button below to access your course materials!

━━━━━━━━━━━━━━━━━━━━━

💡 *Tip:* Upgrade to Pro Trader Plan for full access to all courses, mentorship, and trading signals!
    `;

    const keyboard = {
        inline_keyboard: [
            [{ text: '🔗 Join Free Trial Group', url: groupLink }],
            [{ text: '⭐ Upgrade to Pro Trader', callback_data: 'pay_pro-trader-plan' }],
            [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
        ]
    };

    bot.sendMessage(chatId, successMessage, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
    });

    // Notify admin
    if (ADMIN_TELEGRAM_ID) {
        bot.sendMessage(ADMIN_TELEGRAM_ID, `
🆓 *New Free Trial Signup*

User: ${user.first_name} ${user.last_name || ''} (@${user.username || 'no username'})
Chat ID: ${chatId}
Reference: ${reference}
        `, { parse_mode: 'Markdown' });
    }
}

// ============================================
// WEBHOOK FOR PAYSTACK
// ============================================

app.post('/webhook/paystack', async (req, res) => {
    try {
        const event = req.body;
        
        console.log('Paystack Webhook received:', event.event);

        if (event.event === 'charge.success') {
            const { reference, metadata, amount } = event.data;
            
            // Get pending payment
            const pendingPayment = pendingPayments.get(reference);
            
            if (pendingPayment) {
                const { chatId, planId, planName, user } = pendingPayment;
                const groupLink = TELEGRAM_LINKS[planId];
                const amountGHS = amount / 100;

                // Store subscription
                const isLifetime = ['lifetime-access', '3-year-analytical-stage'].includes(planId);
                subscriptions.set(chatId, {
                    planId: planId,
                    planName: planName,
                    active: true,
                    startDate: new Date().toLocaleDateString(),
                    expiryDate: isLifetime ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
                    reference: reference,
                    groupLink: groupLink,
                    amount: amountGHS
                });

                // Send success message to user
                const successMessage = `
🎉 *Payment Successful!*

━━━━━━━━━━━━━━━━━━━━━

Thank you for enrolling in *${planName}*!

*Amount Paid:* GHS ${amountGHS.toLocaleString()}
*Reference:* \`${reference}\`

━━━━━━━━━━━━━━━━━━━━━

🔗 *Access Your Course:*
Click the button below to join your exclusive Telegram group!

━━━━━━━━━━━━━━━━━━━━━

📋 *Next Steps:*
1. Join the Telegram group
2. Introduce yourself
3. Access course materials
4. Start learning!

━━━━━━━━━━━━━━━━━━━━━

Questions? Contact us:
📧 Themosempire@gmail.com
📱 +233 596 688 947
                `;

                const keyboard = {
                    inline_keyboard: [
                        [{ text: '🔗 Join Your Group Now', url: groupLink }],
                        [{ text: '📞 Contact Support', callback_data: 'contact_support' }],
                        [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
                    ]
                };

                bot.sendMessage(chatId, successMessage, { 
                    parse_mode: 'Markdown',
                    reply_markup: keyboard 
                });

                // Notify admin
                if (ADMIN_TELEGRAM_ID) {
                    bot.sendMessage(ADMIN_TELEGRAM_ID, `
💰 *Payment Received!*

Plan: ${planName}
Amount: GHS ${amountGHS.toLocaleString()}
Reference: ${reference}
User ID: ${chatId}
                    `, { parse_mode: 'Markdown' });
                }

                // Remove from pending
                pendingPayments.delete(reference);
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Error');
    }
});

// Payment callback route (for redirect after payment)
app.get('/payment-callback', (req, res) => {
    const { reference, trxref } = req.query;
    const ref = reference || trxref;
    
    // Redirect to a thank you page or back to Telegram
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Payment Complete - Themosempire Fx</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #007BFF, #28A745);
                    color: white;
                    text-align: center;
                }
                .container {
                    background: white;
                    color: #333;
                    padding: 40px;
                    border-radius: 20px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                    max-width: 400px;
                }
                h1 { color: #28A745; }
                .reference { 
                    background: #f0f0f0; 
                    padding: 10px; 
                    border-radius: 5px; 
                    font-family: monospace;
                    margin: 20px 0;
                }
                .btn {
                    display: inline-block;
                    background: #007BFF;
                    color: white;
                    padding: 15px 30px;
                    border-radius: 50px;
                    text-decoration: none;
                    margin-top: 20px;
                }
                .btn:hover { background: #28A745; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>✅ Payment Complete!</h1>
                <p>Thank you for your payment.</p>
                <div class="reference">Ref: ${ref}</div>
                <p>Please return to Telegram to get your group access link.</p>
                <a href="https://t.me/" class="btn">Back to Telegram</a>
            </div>
        </body>
        </html>
    `);
});

// Health check
app.get('/', (req, res) => {
    res.send('Themosempire Fx Bot is running! 🤖');
});

// ============================================
// ADMIN COMMANDS
// ============================================

// Manual payment confirmation (admin only)
bot.onText(/\/confirm_payment (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    
    // Check if admin
    if (chatId.toString() !== ADMIN_TELEGRAM_ID) {
        bot.sendMessage(chatId, '❌ Unauthorized. This command is for admin only.');
        return;
    }

    const args = match[1].split(' ');
    if (args.length < 2) {
        bot.sendMessage(chatId, 'Usage: /confirm_payment <user_chat_id> <plan_id>');
        return;
    }

    const [userChatId, planId] = args;
    const plan = PLANS[planId];

    if (!plan) {
        bot.sendMessage(chatId, '❌ Invalid plan ID. Available: ' + Object.keys(PLANS).join(', '));
        return;
    }

    const groupLink = TELEGRAM_LINKS[planId];
    const reference = `MANUAL_${Date.now()}`;

    // Store subscription
    subscriptions.set(parseInt(userChatId), {
        planId: planId,
        planName: plan.name,
        active: true,
        startDate: new Date().toLocaleDateString(),
        expiryDate: null,
        reference: reference,
        groupLink: groupLink
    });

    // Send confirmation to user
    const userMessage = `
🎉 *Payment Confirmed!*

Your payment for *${plan.name}* has been manually confirmed by admin.

🔗 *Join Your Group:*
${groupLink}

Reference: ${reference}
    `;

    bot.sendMessage(parseInt(userChatId), userMessage, { 
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🔗 Join Group', url: groupLink }]
            ]
        }
    });

    bot.sendMessage(chatId, `✅ Payment confirmed for user ${userChatId} - ${plan.name}`);
});

// View all users (admin only)
bot.onText(/\/users/, (msg) => {
    const chatId = msg.chat.id;
    
    if (chatId.toString() !== ADMIN_TELEGRAM_ID) {
        bot.sendMessage(chatId, '❌ Unauthorized.');
        return;
    }

    const userList = Array.from(users.values())
        .map(u => `• ${u.firstName} (@${u.username || 'no username'}) - ${u.id}`)
        .join('\n');

    bot.sendMessage(chatId, `👥 *Registered Users (${users.size}):*\n\n${userList || 'No users yet.'}`, { parse_mode: 'Markdown' });
});

// View all subscriptions (admin only)
bot.onText(/\/subscriptions/, (msg) => {
    const chatId = msg.chat.id;
    
    if (chatId.toString() !== ADMIN_TELEGRAM_ID) {
        bot.sendMessage(chatId, '❌ Unauthorized.');
        return;
    }

    const subList = Array.from(subscriptions.entries())
        .map(([id, sub]) => `• ${id}: ${sub.planName} (${sub.active ? 'Active' : 'Inactive'})`)
        .join('\n');

    bot.sendMessage(chatId, `📋 *Subscriptions (${subscriptions.size}):*\n\n${subList || 'No subscriptions yet.'}`, { parse_mode: 'Markdown' });
});

// Broadcast message (admin only)
bot.onText(/\/broadcast (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    
    if (chatId.toString() !== ADMIN_TELEGRAM_ID) {
        bot.sendMessage(chatId, '❌ Unauthorized.');
        return;
    }

    const message = match[1];
    let sent = 0;

    users.forEach((user, id) => {
        try {
            bot.sendMessage(id, `📢 *Announcement from Themosempire Fx:*\n\n${message}`, { parse_mode: 'Markdown' });
            sent++;
        } catch (err) {
            console.error(`Failed to send to ${id}:`, err);
        }
    });

    bot.sendMessage(chatId, `✅ Broadcast sent to ${sent} users.`);
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Webhook URL: ${process.env.WEBHOOK_URL || 'Not configured'}`);
    console.log('✅ Themosempire Fx Bot is ready!');
});

// Handle errors
bot.on('polling_error', (error) => {
    console.error('Polling error:', error.code);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

console.log('🤖 Bot initialized successfully!');
